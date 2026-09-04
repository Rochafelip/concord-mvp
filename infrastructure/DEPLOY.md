# Production Deployment

This is the manual runbook for deploying concord-mvp to a real production
VM with a real domain and trusted HTTPS (Let's Encrypt). For a quick,
no-domain-required local review deployment instead, see
[`VM_REVIEW.md`](./VM_REVIEW.md).

No automated deployment pipeline exists yet (docs/DECISIONS.md D5) — this
is a manual, step-by-step process, same spirit as `VM_REVIEW.md`.

## Prerequisites

* A VM from any provider, with a public IP, Docker and the Docker Compose
  plugin installed. Not tied to a specific provider — any Linux VM works.
* A registered domain (or subdomain) with its DNS **A record** pointed at
  the VM's public IP. Let's Encrypt validates ownership by connecting to
  this domain over HTTP, so the DNS record must already be live before
  certificate issuance (step 4 below).
* The VM's firewall (and, if applicable, the provider's own network/
  security-group rules) open on:
  * `80/tcp`, `443/tcp` — HTTP(S) and the ACME challenge.
  * `7881/tcp` — LiveKit ICE-over-TCP fallback.
  * `3478/udp`, `5349/tcp` — LiveKit's embedded TURN relay.
  * `50000-60000/udp` — LiveKit's WebRTC media port range
    (`infrastructure/livekit/livekit.yaml`'s `rtc.port_range_start`/
    `port_range_end` — if you changed that range, open the matching ports
    instead).

## 1. Clone the repo

```bash
git clone https://github.com/Rochafelip/concord-mvp.git
cd concord-mvp/infrastructure
```

## 2. Configure `.env`

```bash
cp .env.example .env
```

Edit `.env` and fill in **real** values — never reuse `.env.example`'s
placeholders for anything reachable from the internet:

* `POSTGRES_PASSWORD`, `JWT_SECRET`, `LIVEKIT_API_SECRET` — generate with
  `openssl rand -base64 32` (or `-base64 24` for `POSTGRES_PASSWORD`,
  matching `.env.example`'s existing guidance).
* `LIVEKIT_API_KEY` — any identifier string; doesn't need to be secret,
  just needs to match between the backend and the livekit service (both
  read it from this same `.env`).
* `DOMAIN` — your real domain from the Prerequisites section.
* `ACME_EMAIL` — a real email address; Let's Encrypt uses it for expiry
  reminders and account recovery.
* `LIVEKIT_PUBLIC_URL` — `wss://<your domain>/livekit` (replacing the
  placeholder IP-based example).

## 3. Point LiveKit's TURN listener at the real domain

Edit `infrastructure/livekit/livekit.yaml`'s `turn.domain` line (currently
`CHANGE-ME-vm-public-ip`) to your real domain — the same file, same single
line, `docs/DECISIONS.md` D16 already asks you to edit for the self-signed
case; nothing new here, just a different value. No other line in this
file needs to change — `turn.cert_file`/`turn.key_file` keep pointing at
`selfsigned.crt`/`selfsigned.key`, which in production actually holds the
real Let's Encrypt cert (see `infrastructure/certbot/deploy-hook.sh`'s
comment for why the filenames stayed the same).

## 4. Certificate bootstrap and initial issuance

```bash
# 1. Placeholder cert, so nginx can start at all (see bootstrap-placeholder-cert.sh's comment
#    for why this step exists).
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm bootstrap-cert

# 2. Bring up the full stack — nginx now starts successfully against the placeholder.
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build

# 3. Issue the real certificate via the webroot method (nginx, already running, answers the
#    challenge). Replace the two $-prefixed values below with the same DOMAIN/ACME_EMAIL you set
#    in .env, or export them first (`export $(grep -E '^(DOMAIN|ACME_EMAIL)=' .env)`).
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml \
  run --rm certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --deploy-hook /deploy-hook.sh \
  -m "$ACME_EMAIL" --agree-tos --non-interactive

# 4. Reload nginx to pick up the real cert (no restart, no downtime beyond the reload itself).
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml \
  exec nginx nginx -s reload
```

## 5. Verify

* `curl -v https://<your domain>/actuator/health` — should succeed with
  **no** certificate warning (a real, browser-trusted Let's Encrypt
  cert), and return the backend's health JSON.
* Open `https://<your domain>` in a browser, register/log in, join a
  voice channel, and toggle camera + screen share — confirms LiveKit's
  TURN/TLS listener is serving correctly over the new certificate too,
  not just nginx's own HTTPS.

## 6. Set up automatic renewal

Add a daily cron entry (`crontab -e`) on the VM — `certbot renew` is a
no-op unless the cert is within 30 days of expiry, so running it daily is
safe:

```cron
0 3 * * * cd /path/to/concord-mvp/infrastructure && docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot renew --deploy-hook /deploy-hook.sh --quiet && docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload
```

Replace `/path/to/concord-mvp` with the actual clone path on the VM. The
`--deploy-hook` re-runs `deploy-hook.sh` (keeping LiveKit's cert copy in
sync) on any renewal that actually replaces the certificate; it's a no-op
on days `renew` decides nothing needs to happen yet.

## Day-to-day: deploying updates

```bash
cd /path/to/concord-mvp
git pull
cd infrastructure
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Same update pattern `VM_REVIEW.md` already uses for the review VM.

## Out of scope

Monitoring and automated database backups are intentionally not covered
here — see `docs/OPEN_QUESTIONS.md` Q32 and `docs/DATABASE.md` §40. If
those become a real need later, they're separate follow-up work, not a
gap in this runbook.
