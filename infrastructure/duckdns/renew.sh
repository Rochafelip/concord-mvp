#!/usr/bin/env bash
set -euo pipefail

# Renews the DuckDNS-issued Let's Encrypt certificate and, only if the certificate actually
# changed, redeploys it to the services that serve it. Safe to run daily from cron — acme.sh
# only renews within 30 days of expiry, so this is a no-op most days.
#
# "Only if it changed" is load-bearing, not an optimization: redeploying means
# `docker compose restart livekit`, which drops every active voice call (LiveKit has no
# live-reload for its TLS listener). A daily cron that restarted it unconditionally would
# disconnect calls once a day for no reason.
#
# The comparison is against the *deployed* copy rather than a before/after snapshot of this
# run, so a previous run that renewed but failed partway through the copy gets repaired on the
# next run instead of leaving nginx serving a stale certificate until the next renewal window.
#
# See DUCKDNS.md for the full setup, the crontab line, and how to verify renewal works.

cd "$(dirname "${BASH_SOURCE[0]}")/.."

STATE_DIR="duckdns/acme-state"
DEPLOYED_CRT="nginx/certs/selfsigned.crt"
DEPLOYED_KEY="nginx/certs/selfsigned.key"

[ -f .env ] || { echo "No .env found — see DUCKDNS.md." >&2; exit 1; }
DUCKDNS_TOKEN="$(grep -E '^DUCKDNS_TOKEN=' .env | cut -d= -f2-)"
[ -n "$DUCKDNS_TOKEN" ] || { echo "DUCKDNS_TOKEN not set in .env — see DUCKDNS.md." >&2; exit 1; }

[ -d "$STATE_DIR" ] || { echo "No $STATE_DIR — the certificate was never issued. See DUCKDNS.md." >&2; exit 1; }

# acme.sh runs as the invoking user (--user below) so it never writes root-owned files into the
# working tree. If the state was created by a root-run container, every renewal fails deep inside
# acme.sh with a bare "Permission denied" on account.conf; catch it here with the fix instead.
if [ ! -w "$STATE_DIR" ] || { [ -e "$STATE_DIR/account.conf" ] && [ ! -w "$STATE_DIR/account.conf" ]; }; then
  echo "Error: $(pwd)/$STATE_DIR is not writable by $(id -un) (uid $(id -u))." >&2
  echo "acme.sh runs as your uid here, so renewal cannot work. Fix with:" >&2
  echo "  sudo chown -R $(id -u):$(id -g) $(pwd)/$STATE_DIR" >&2
  exit 1
fi

DOMAIN_DIR="$(find "$STATE_DIR" -maxdepth 1 -type d -name '*.duckdns.org_ecc' | head -n1)"
[ -n "$DOMAIN_DIR" ] || { echo "Could not find an issued certificate under $STATE_DIR/ — see DUCKDNS.md." >&2; exit 1; }
DOMAIN="$(basename "$DOMAIN_DIR" _ecc)"
ISSUED_CRT="${DOMAIN_DIR}/fullchain.cer"
ISSUED_KEY="${DOMAIN_DIR}/${DOMAIN}.key"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/acme.sh \
  -e DuckDNS_Token="${DUCKDNS_TOKEN}" \
  -v "$(pwd)/duckdns/acme-state:/acme.sh" \
  neilpang/acme.sh --cron --home /acme.sh

if cmp -s "$ISSUED_CRT" "$DEPLOYED_CRT"; then
  echo "No change for ${DOMAIN} — deployed certificate is already current; not touching nginx or livekit."
else
  echo "Certificate for ${DOMAIN} changed — redeploying."
  cp "$ISSUED_CRT" "$DEPLOYED_CRT"
  cp "$ISSUED_KEY" "$DEPLOYED_KEY"
  docker compose exec nginx nginx -s reload
  docker compose restart livekit
  echo "Redeployed: nginx reloaded, livekit restarted."
fi

if command -v openssl >/dev/null 2>&1; then
  echo "Deployed certificate: $(openssl x509 -in "$DEPLOYED_CRT" -noout -subject -enddate | tr '\n' ' ')"
fi
