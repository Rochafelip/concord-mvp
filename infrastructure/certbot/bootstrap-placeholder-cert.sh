#!/bin/sh
set -eu

# Generates a short-lived, throwaway self-signed cert at the exact filesystem path Let's Encrypt
# will later populate for real (/etc/letsencrypt/live/$DOMAIN/{fullchain,privkey}.pem). nginx's
# production config (nginx.prod.conf.template) references this path unconditionally in its 443
# server block, and nginx refuses to start AT ALL — not even its unrelated port-80 block — if any
# referenced certificate file is missing, since it validates the whole config file before
# starting anything. But real Let's Encrypt issuance (webroot method, see deploy-hook.sh's
# sibling comment) needs nginx already running to answer the HTTP-01 challenge. This script
# breaks that chicken-and-egg cycle: nginx starts successfully against this placeholder, serves
# the ACME challenge for real issuance, and the placeholder gets overwritten by the real cert at
# the same path — see infrastructure/DEPLOY.md's "Certificate bootstrap" section for the full
# command sequence this fits into.
apk add --no-cache openssl >/dev/null

DOMAIN="${DOMAIN:?DOMAIN environment variable must be set}"
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
mkdir -p "${LIVE_DIR}"

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "${LIVE_DIR}/privkey.pem" \
  -out "${LIVE_DIR}/fullchain.pem" \
  -days 1 -subj "/CN=${DOMAIN}"

echo "Placeholder cert written to ${LIVE_DIR} — will be replaced by the real Let's Encrypt cert in the next step."
