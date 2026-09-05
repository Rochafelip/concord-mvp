# Home-PC deployment (router port-forwarding, no domain)

This is the manual runbook for running concord-mvp directly on your own
PC, exposed to the internet through your home router's Port Mapping
(a.k.a. port forwarding) feature — no VPS, no cloud VM, no tunnel
service. For a real domain with trusted HTTPS via Let's Encrypt instead,
see [`DEPLOY.md`](./DEPLOY.md). For a quick, no-router-config-required
review deployment behind a Cloudflare Quick Tunnel, see
[`VM_REVIEW.md`](./VM_REVIEW.md).

This path uses the base `docker-compose.yml` unmodified — the same
self-signed-TLS, self-hosted-LiveKit design documented in
`docs/DECISIONS.md` D16 ("no domain yet"), which already assumes "some
machine with a public IP." Your PC satisfies that directly once the
router forwards the right ports to it.

## Prerequisites

* Docker and the Docker Compose plugin installed on the PC — on
  Windows, use **Docker Desktop with WSL Integration** specifically
  (see step 3 for why bare `dockerd` inside WSL2 doesn't work here).
* A router that supports Port Mapping / port forwarding (not DMZ —
  DMZ exposes every port on the PC, which is unnecessary and riskier
  than forwarding only what's needed).
* The PC's LAN IP reserved via the router's DHCP settings (e.g.
  `192.168.1.2`). Port Mapping rules target this IP directly — if the
  router hands the PC a different lease after a reboot, every rule
  below silently breaks. A DHCP reservation prevents that.
* Your current public IPv4 address (check e.g. via the router's status
  page). This runbook uses `<YOUR_PUBLIC_IP>` as a placeholder —
  substitute your own throughout, and see "If your public IP changes"
  below for what to do when it does.

## 1. Clone the repo

```bash
git clone https://github.com/Rochafelip/concord-mvp.git
cd concord-mvp/infrastructure
```

## 2. Router configuration

Add these Port Mapping rules, all forwarding to the PC's LAN IP, same
port on both the WAN and LAN side — the same mechanism already used to
validate connectivity on TCP 45678 (which is unrelated to the app and
stays as-is):

| WAN Port | Protocol | Purpose |
|---|---|---|
| 45678 | TCP | HTTPS — the real public entry point (see step 5: most residential ISPs block inbound 80/443, confirmed for this deployment) |
| 7881 | TCP | LiveKit ICE-over-TCP fallback |
| 3478 | UDP | LiveKit's embedded TURN relay |
| 5349 | TCP | LiveKit TURN-over-TLS |
| 20000-20099 | UDP | LiveKit WebRTC media — direct/non-relayed candidates (`livekit.yaml`'s `rtc.port_range_start`/`port_range_end`) |
| 22000-22099 | UDP | LiveKit WebRTC media — TURN-relayed candidates (`livekit.yaml`'s `turn.relay_range_start`/`relay_range_end`) |

80 and 443 are deliberately **not** in this table: this deployment
confirmed the ISP drops inbound traffic on both from outside the LAN
(step 5), so forwarding them buys nothing for external access. Only add
them back if you want `https://<LAN IP>` reachable at the standard port
from inside your own LAN — that's a local convenience, not something a
router Port Mapping rule affects either way.

If you change either UDP range, update both this table's rule and the
matching `docker-compose.yml` port publish to match. Don't open a wider
range than this — 100 ports each is already roughly 100 simultaneous
direct/relayed connections, comfortably more than a friends-group
deployment (`docs/DECISIONS.md` D1) needs, and every extra port is both
unnecessary exposure and (see next paragraph) real startup cost.

The ranges are deliberately small (100 ports, not 1,000+) and start at
`20000`, below Windows' default dynamic/ephemeral port range
(49152-65535). Two lessons learned the hard way while setting this up:

* A range inside 49152-65535 (the original choice, `50000-51000`) can
  randomly fail to bind — Windows reserves chunks of it dynamically
  (and Hyper-V/WSL2's virtual switch holds some ranges permanently —
  check with `netsh interface ipv4 show excludedportrange protocol=udp`
  in an elevated PowerShell if you ever see `bind: address already in
  use` on a UDP port that's otherwise idle).
* A range in the *thousands* of ports takes Docker a very long time to
  publish on a WSL2/Docker-Desktop host (each port becomes its own
  firewall rule at container start) — in testing, ~2,000 ports took
  several minutes and sometimes hung the Docker daemon outright, even
  after disabling `userland-proxy` in `/etc/docker/daemon.json`
  (`{"userland-proxy": false}`, needs `sudo systemctl restart docker`
  to apply — worth doing regardless, since it also speeds up the
  smaller ranges here). Keep both ranges at 100 ports unless you have a
  concrete reason to need more simultaneous connections, and expect
  container start time to grow noticeably if you widen them.

## 3. Docker engine: use Docker Desktop, not bare `dockerd` inside WSL2

If you're on Windows, install
[Docker Desktop](https://www.docker.com/products/docker-desktop/) and
enable **WSL Integration** with your distro (Docker Desktop → Settings →
Resources → WSL Integration), rather than running `dockerd` natively
inside a WSL2 distro (`sudo apt install docker-ce` or similar). This
isn't a style preference — two approaches were tried and only one
actually exposes ports to the internet correctly:

* **Bare `dockerd` in WSL2, "mirrored" networking mode**
  (`networkingMode=mirrored` in `%UserProfile%\.wslconfig`, which makes
  WSL2 share the PC's real LAN IP directly): Docker's published ports
  listen correctly *inside* WSL2, and same-machine/hairpin tests can
  even appear to succeed, but genuinely external traffic (arriving via
  the router's NAT from outside the LAN) is not reliably routed into
  WSL2's listeners. LAN-local requests can also fail the same way.
* **Bare `dockerd` in WSL2, default NAT mode + `netsh interface
  portproxy`** (manually forwarding each Windows port into WSL2's
  internal IP): works for TCP, but `netsh interface portproxy` [only
  supports TCP](https://learn.microsoft.com/) — `protocol=udp` fails
  with "incorrect parameter" regardless of Windows version. LiveKit
  needs UDP for media and TURN, so this path is a dead end for voice.
* **Docker Desktop with WSL Integration** (recommended): Docker
  Desktop's own backend binds published container ports — TCP *and*
  UDP — directly on the Windows host's real network interfaces, which
  is exactly what a router's Port Mapping rule needs to reach. This is
  the standard, well-tested path; use it instead of troubleshooting the
  two options above further.

If you switch from a bare WSL2 `dockerd` to Docker Desktop, stop and
disable the old one first so it doesn't hold onto the ports:

```bash
sudo systemctl stop docker docker.socket
sudo systemctl disable docker docker.socket
```

Docker Desktop uses its own separate image/container/volume storage —
`docker compose up -d --build` after switching rebuilds everything from
scratch (any existing data in named volumes, e.g. `postgres_data`, does
**not** carry over automatically; dump/restore it first if it matters).

## 4. Windows Firewall

Open an elevated PowerShell and allow the ports forwarded in step 2:

```powershell
New-NetFirewallRule -DisplayName "Concord-App-45678" -Direction Inbound -Protocol TCP -LocalPort 45678 -Action Allow
New-NetFirewallRule -DisplayName "Concord-LK-TCP" -Direction Inbound -Protocol TCP -LocalPort 7881 -Action Allow
New-NetFirewallRule -DisplayName "Concord-TURN-UDP" -Direction Inbound -Protocol UDP -LocalPort 3478 -Action Allow
New-NetFirewallRule -DisplayName "Concord-TURN-TLS" -Direction Inbound -Protocol TCP -LocalPort 5349 -Action Allow
New-NetFirewallRule -DisplayName "Concord-LK-Media" -Direction Inbound -Protocol UDP -LocalPort 20000-20099 -Action Allow
New-NetFirewallRule -DisplayName "Concord-LK-Relay" -Direction Inbound -Protocol UDP -LocalPort 22000-22099 -Action Allow
```

Only add `Concord-HTTP`/`Concord-HTTPS` rules for 80/443 if you also
added those router rules back for LAN-only access (see step 2's note).

On a dedicated Linux host instead of Windows+WSL2, open the same ports
with whatever firewall tool that host uses (`ufw`/`firewalld`/etc.)
instead of the above.

## 5. If your ISP blocks 80/443: reuse the validated test port

Some residential ISPs silently drop inbound traffic on the well-known
ports 80/443 (to discourage running unauthorized servers) while leaving
arbitrary high ports open — even when the router's Port Mapping and
every other config is correct. This is straightforward to confirm:
publish a plain test container on your already-validated TCP test port
(`45678` in this repo's case) and check whether *that* is reachable from
outside while 443 isn't — confirmed to be the case for this deployment
(tested from an external network on mobile data: `45678` reaches the
app, `443` doesn't). `docker-compose.yml` already carries the
workaround: nginx's port 443 is also published on the host as `45678`
(`"45678:443"`, alongside the normal `"443:443"`), reusing the router
rule and Windows Firewall rule from steps 2/4.

The public URL is `https://<your public IP>:45678`, and
`LIVEKIT_PUBLIC_URL` in `.env` (step 6) needs the same port:
`wss://<your public IP>:45678/livekit`. If 443 works fine for you
instead (test before assuming either way), you can forward 80/443 on
your router and drop the `"45678:443"` mapping — see step 2's note.

## 6. Configure `.env`

```bash
cp .env.example .env
```

Edit `.env` and fill in **real** values — never reuse `.env.example`'s
placeholders for anything reachable from the internet:

* `POSTGRES_PASSWORD`, `JWT_SECRET`, `LIVEKIT_API_SECRET` — generate
  with `openssl rand -base64 32` (or `-base64 24` for
  `POSTGRES_PASSWORD`).
* `LIVEKIT_API_KEY` — any identifier string; doesn't need to be secret,
  just needs to match between the backend and the livekit service (both
  read it from this same `.env`).
* `LIVEKIT_PUBLIC_URL=wss://<YOUR_PUBLIC_IP>/livekit` — replace with your
  own public IP. If step 5 applies to you (ISP blocks 80/443), append
  the workaround port instead: `wss://<your public IP>:45678/livekit`.
* Leave `DOMAIN` and `ACME_EMAIL` as-is (or unset) — they're only used
  by the Let's Encrypt path in `DEPLOY.md` and have no effect here.

## 7. Generate the self-signed certificate

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout nginx/certs/selfsigned.key \
  -out nginx/certs/selfsigned.crt \
  -days 3650 -subj "/CN=<YOUR_PUBLIC_IP>"
```

Use your own public IP in `-subj`. This must match `turn.domain` in the
next step and `LIVEKIT_PUBLIC_URL` above — a mismatch shows browsers a
hostname-mismatch warning on top of the expected self-signed-cert one.
Never commit `nginx/certs/` — it holds a private key
(`infrastructure/.gitignore` already excludes it).

## 8. Point LiveKit's TURN listener at your public IP

Edit `infrastructure/livekit/livekit.yaml`'s `turn.domain` line (and, if
you're setting `rtc.use_external_ip: false`, its `node_ip` line too) to
match the `CN` used above — both are `CHANGE-ME-*` placeholders in this
repo; replace with your own value locally, and don't commit the real
value back.

## 9. Bring up the stack

```bash
docker compose up -d --build
```

Just the base `docker-compose.yml` — no `-f docker-compose.prod.yml`
(that override is for the Let's Encrypt path in `DEPLOY.md` and doesn't
apply here).

## 10. Verify

Use `:45678` in every URL below instead of the bare address if step 5's
workaround applies to you.

* From a network *outside* your LAN (e.g. a phone on mobile data, not
  your home Wi-Fi) — `curl -vk https://<YOUR_PUBLIC_IP>/actuator/health`
  should succeed (`-k` because the cert is self-signed) and return the
  backend's health JSON. This confirms the port-forwarding path
  actually works end-to-end, not just that Docker started. If this
  specific step times out while other ports you've forwarded work fine,
  see step 5 — it's very likely 80/443 being blocked upstream, not
  anything wrong with this setup.
* Open `https://<YOUR_PUBLIC_IP>` in a browser (also from outside your
  LAN), accept the one-time certificate warning, register/log in, join
  a voice channel, and toggle camera + screen share — confirms nginx,
  LiveKit signaling, and LiveKit media (UDP/TURN) are all independently
  reachable through the router.
* If possible, repeat the browser walkthrough from a second external
  network or device (e.g. a friend) — your own test may be from a
  network with unusually permissive NAT/firewall behavior that a
  friend's network won't share.

## If your public IP changes

Residential PPPoE connections can get a new public IP on reconnect.
When that happens, three places need updating, then a restart:

1. Regenerate the self-signed cert (step 7) with the new IP in
   `-subj "/CN=..."`.
2. Update `turn.domain` in `livekit.yaml` (step 8) to match.
3. Update `LIVEKIT_PUBLIC_URL` in `.env` (step 6) to match — keep the
   `:45678` suffix if step 5's workaround applies to you; only the IP
   changes.

Then:

```bash
docker compose exec nginx nginx -s reload
docker compose restart livekit
```

The reload picks up the new cert without dropping active connections;
`livekit` needs a full restart since it has no live-reload mechanism
for its TLS listener.

No router change is needed for a public IP change alone — Port Mapping
rules forward by the PC's *local* IP, which doesn't change just because
the WAN side did. A router rule change is only needed if the PC's LAN
IP itself changes, which the DHCP reservation in Prerequisites is meant
to prevent.

## Day-to-day: deploying updates

```bash
cd /path/to/concord-mvp
git pull
cd infrastructure
docker compose up -d --build
```

Same update pattern `DEPLOY.md` and `VM_REVIEW.md` already use.

## Out of scope

Monitoring and automated database backups are intentionally not
covered here — see `docs/OPEN_QUESTIONS.md` Q32 and
`docs/DATABASE.md` §40. Dynamic DNS is also out of scope — this runbook
uses the raw public IP and documents the manual update procedure above;
if IP changes turn out to be frequent enough to be annoying, adding a
DDNS hostname later is a reasonable follow-up.
