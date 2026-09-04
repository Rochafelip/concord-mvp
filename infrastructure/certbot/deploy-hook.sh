#!/bin/sh
set -eu

# Copies the current Let's Encrypt cert pair into the volume shared with the livekit container
# (docker-compose.prod.yml's livekit_certs volume), with permissions the livekit-server process
# (which does not run as root) can read, under the exact filenames
# infrastructure/livekit/livekit.yaml already hard-codes for turn.cert_file/turn.key_file
# (selfsigned.crt/selfsigned.key) — so despite the name, in production this file pair holds the
# real Let's Encrypt cert, not a self-signed one. This keeps livekit.yaml itself unchanged
# between the self-signed and production cases (docs/superpowers/specs/
# 2026-09-04-phase5-production-deploy-design.md §3.6), same as how it already only needs a
# manual turn.domain edit, not a code change, to move from the review VM to production.
#
# Run automatically by certbot on both initial issuance and every renewal, via --deploy-hook (see
# infrastructure/DEPLOY.md) — certbot only invokes deploy-hooks after a cert actually changes, so
# this never runs needlessly on a no-op renewal check.
DOMAIN="${DOMAIN:?DOMAIN environment variable must be set}"
SRC="/etc/letsencrypt/live/${DOMAIN}"
DEST="/livekit-certs"

cp "${SRC}/fullchain.pem" "${DEST}/selfsigned.crt"
cp "${SRC}/privkey.pem" "${DEST}/selfsigned.key"
chmod 644 "${DEST}/selfsigned.crt" "${DEST}/selfsigned.key"

echo "Copied ${SRC} -> ${DEST} for LiveKit."
