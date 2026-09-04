#!/bin/sh
set -eu

# Generates a short-lived, throwaway self-signed cert at the exact filesystem path Let's Encrypt
# will later populate for real (/etc/letsencrypt/live/$DOMAIN/{fullchain,privkey}.pem), AND a
# copy at the path LiveKit's TURN/TLS listener reads on container start
# (/livekit-certs/selfsigned.{crt,key} — see infrastructure/livekit/livekit.yaml's
# turn.cert_file/turn.key_file). nginx's production config (nginx.prod.conf.template) references
# the first path unconditionally in its 443 server block, and nginx refuses to start AT ALL —
# not even its unrelated port-80 block — if any referenced certificate file is missing, since it
# validates the whole config file before starting anything. LiveKit has the same problem for its
# own TURN/TLS listener (turn.enabled: true is unconditional in livekit.yaml): docker-compose.yml's
# nginx service depends_on livekit (condition: service_started), so a livekit that fails to start
# over a missing cert can block nginx from starting too, which would in turn break the real Let's
# Encrypt issuance in the next step (it needs nginx up to answer the HTTP-01 challenge). This
# placeholder breaks that chicken-and-egg cycle for both services: nginx and livekit both start
# successfully against these placeholders, nginx serves the ACME challenge for real issuance, and
# both placeholders get overwritten by the real cert (deploy-hook.sh) — LiveKit needs an explicit
# restart afterward to pick its copy up, since (unlike nginx) it has no live-reload mechanism for
# its TLS listener. See infrastructure/DEPLOY.md's "Certificate bootstrap" section for the full
# command sequence this fits into.
apk add --no-cache openssl >/dev/null

DOMAIN="${DOMAIN:?DOMAIN environment variable must be set}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
mkdir -p "${LIVE_DIR}"

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "${LIVE_DIR}/privkey.pem" \
  -out "${LIVE_DIR}/fullchain.pem" \
  -days 1 -subj "/CN=${DOMAIN}"

cp "${LIVE_DIR}/fullchain.pem" /livekit-certs/selfsigned.crt
cp "${LIVE_DIR}/privkey.pem" /livekit-certs/selfsigned.key
chmod 644 /livekit-certs/selfsigned.crt /livekit-certs/selfsigned.key

echo "Placeholder certs written to ${LIVE_DIR} and /livekit-certs — both will be replaced by the real Let's Encrypt cert in the next steps."
