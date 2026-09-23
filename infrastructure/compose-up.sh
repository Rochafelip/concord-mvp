#!/usr/bin/env bash
set -euo pipefail

# Guards manual production deploys: `docker compose up` runs the real production
# stack on this PC (HOME_DEPLOY.md/DEPLOY.md), so running it by habit from
# whatever branch happens to be checked out (e.g. a feature/dev branch mid-review)
# would deploy code that never went through the master PR/CI gate (CI_CD.md).
# The automated path (cd-production.yml) already only triggers on push to master;
# this script is the same guarantee for the manual runbook path.
#
# Drop-in replacement for `docker compose` itself (not just the `up` subcommand) —
# global flags like -f/--env-file must precede the subcommand in Compose's CLI, so
# this can't insert `up` for you. Call it exactly like `docker compose`, e.g.:
#   ./compose-up.sh up -d
#   ./compose-up.sh --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build

cd "$(dirname "${BASH_SOURCE[0]}")"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "master" ]; then
  echo "Refusing to run: current branch is '$BRANCH', not 'master'." >&2
  echo "This starts the production stack — checkout master first: git checkout master && git pull" >&2
  exit 1
fi

exec docker compose "$@"
