# Optional: local review VM

This is an optional, solo-developer workflow for running the Phase 1 stack
in an isolated VM on your own machine and exposing it publicly for a
quick review — no cloud VM, no domain, no account required. It's meant
for demoing/reviewing the app with friends before a real deployment, not
as a long-term production setup.

Requires QEMU/KVM (Linux host, or WSL2 with `/dev/kvm` available) and
[`cloudflared`](https://github.com/cloudflare/cloudflared) installed on
the host.

## Setup

Pick a directory to hold the VM's files (outside this repo — it includes
a disk image and an SSH key, neither of which belong in version control).
The examples below use `~/vms/concord-mvp-review`; substitute your own
path throughout.

```bash
mkdir -p ~/vms/concord-mvp-review
cd ~/vms/concord-mvp-review

# Ubuntu 24.04 cloud image + a 20GB writable overlay
curl -L --fail -o base.img https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
qemu-img create -f qcow2 -F qcow2 -b base.img disk.qcow2 20G

# Dedicated SSH keypair for this VM
ssh-keygen -t ed25519 -f ssh_key -N "" -C "concord-mvp-review"

# cloud-init seed (first-boot config: hostname + your SSH key, no password auth)
cat > meta-data <<EOF
instance-id: concord-mvp-review-01
local-hostname: concord-mvp-review
EOF
cat > user-data <<EOF
#cloud-config
hostname: concord-mvp-review
ssh_authorized_keys:
  - $(cat ssh_key.pub)
ssh_pwauth: false
package_update: true
EOF
cloud-localds seed.iso user-data meta-data
```

## Scripts

Save these three scripts into the same directory and `chmod +x` them.

**`start-vm.sh`** — boots the VM (2 vCPU / 2GB RAM; adjust `-m`/`-smp` if
you want more), waits for SSH:

```bash
#!/usr/bin/env bash
set -euo pipefail
VM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$VM_DIR/vm.pid" ] && kill -0 "$(cat "$VM_DIR/vm.pid")" 2>/dev/null; then
  echo "VM already running (pid $(cat "$VM_DIR/vm.pid"))."
  exit 0
fi
rm -f "$VM_DIR/vm.pid"

qemu-system-x86_64 \
  -enable-kvm \
  -m 2048 \
  -smp 2 \
  -drive file="$VM_DIR/disk.qcow2",if=virtio,format=qcow2 \
  -drive file="$VM_DIR/seed.iso",if=virtio,format=raw \
  -netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::8080-:80 \
  -device virtio-net-pci,netdev=net0 \
  -display none \
  -serial file:"$VM_DIR/serial.log" \
  -daemonize \
  -pidfile "$VM_DIR/vm.pid"

echo "VM starting (pid $(cat "$VM_DIR/vm.pid")). Waiting for SSH on localhost:2222..."
for i in $(seq 1 60); do
  if ssh -p 2222 -i "$VM_DIR/ssh_key" \
      -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      -o ConnectTimeout=2 -o BatchMode=yes \
      ubuntu@localhost 'echo ready' 2>/dev/null | grep -q ready; then
    echo "VM is up and SSH is ready."
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for SSH after 120s. Check $VM_DIR/serial.log"
exit 1
```

**`stop-vm.sh`** — graceful shutdown over SSH, with a SIGTERM→SIGKILL
fallback if the guest doesn't respond:

```bash
#!/usr/bin/env bash
set -euo pipefail
VM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$VM_DIR/vm.pid" ]; then
  echo "No vm.pid found — VM doesn't appear to be running."
  exit 0
fi

PID="$(cat "$VM_DIR/vm.pid")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "VM process $PID not running. Cleaning up stale pidfile."
  rm -f "$VM_DIR/vm.pid"
  exit 0
fi

echo "Requesting graceful shutdown over SSH..."
ssh -p 2222 -i "$VM_DIR/ssh_key" \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=5 -o BatchMode=yes \
  ubuntu@localhost 'sudo shutdown now' || true

echo "Waiting up to 30s for the VM process to exit..."
for i in $(seq 1 15); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "VM stopped cleanly."
    rm -f "$VM_DIR/vm.pid"
    exit 0
  fi
  sleep 2
done

echo "VM did not shut down gracefully in time — forcing kill (SIGTERM)."
kill "$PID" 2>/dev/null || true

for i in $(seq 1 5); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "VM stopped after SIGTERM."
    rm -f "$VM_DIR/vm.pid"
    exit 0
  fi
  sleep 1
done

echo "Still alive after SIGTERM — escalating to SIGKILL."
kill -9 "$PID" 2>/dev/null || true
sleep 1

if kill -0 "$PID" 2>/dev/null; then
  echo "WARNING: process $PID is still alive after SIGKILL. Not removing vm.pid —" \
       "investigate manually before running start-vm.sh again (starting a second" \
       "QEMU instance against the same disk.qcow2 while this one is still alive" \
       "would corrupt the disk image)."
  exit 1
fi

echo "VM stopped."
rm -f "$VM_DIR/vm.pid"
```

**`start-tunnel.sh`** — exposes the VM publicly via a Cloudflare Quick
Tunnel (no account or domain needed; the URL is random and changes every
restart):

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "Starting Cloudflare Quick Tunnel -> http://localhost:8080"
echo "Watch below for the https://*.trycloudflare.com URL — share that with friends."
echo "Press Ctrl+C to stop the tunnel (does not stop the VM)."
cloudflared tunnel --url http://localhost:8080
```

## Deploying the app inside the VM

Once `start-vm.sh` reports SSH is ready, install Docker and bring up the
stack — this is the same `docker-compose.yml` used everywhere else in
this repo, unmodified:

```bash
ssh -p 2222 -i ssh_key ubuntu@localhost 'curl -fsSL https://get.docker.com | sudo sh'

ssh -p 2222 -i ssh_key ubuntu@localhost 'git clone https://github.com/Rochafelip/concord-mvp.git'

ssh -p 2222 -i ssh_key ubuntu@localhost '
  cd ~/concord-mvp/infrastructure
  JWT_SECRET=$(openssl rand -base64 32)
  POSTGRES_PASSWORD=$(openssl rand -base64 24)
  cat > .env <<EOF
POSTGRES_DB=concordmvp
POSTGRES_USER=concordmvp
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
EOF
  sudo docker compose up -d --build
'
```

Generate real secrets here — never reuse `infrastructure/.env.example`'s
placeholder values for anything reachable from the internet.

## Day-to-day usage

```bash
./start-vm.sh       # boots the VM, waits for SSH
./start-tunnel.sh    # foreground; prints the https://*.trycloudflare.com
                      # URL to share — Ctrl+C stops just the tunnel
./stop-vm.sh          # takes the VM down
```

SSH into the guest directly: `ssh -p 2222 -i ssh_key ubuntu@localhost`

To pull a newer version after a new push to `main`/`master`:

```bash
ssh -p 2222 -i ssh_key ubuntu@localhost \
  'cd ~/concord-mvp && git pull && cd infrastructure && sudo docker compose up -d --build'
```

The tunnel URL isn't stable — it changes every time `start-tunnel.sh` is
restarted. That's an accepted trade-off for a zero-setup review
deployment; if a stable link is ever wanted, register a domain, add it to
a Cloudflare account, and use a named tunnel (`cloudflared tunnel create`
+ `cloudflared tunnel route dns`) instead of `cloudflared tunnel --url`.
