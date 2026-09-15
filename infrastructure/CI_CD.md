# CI/CD

Supersedes `docs/DECISIONS.md` D5's "no automated deployment yet" for production.
See `docs/superpowers/specs/2026-09-15-cicd-design.md` for the full design rationale
(gitignored — local copy only).

## Overview

```text
feature/*  →  PR  →  dev     (CI only, no deploy)
                       │
                      PR
                       ▼
                     master  →  CI  →  CD (self-hosted runner)  →  production
```

* `dev` and `master` are protected: PR required, 1 human approval required, CI must
  pass, no direct pushes.
* `dev` never gets an automated deploy — this machine only has one public IP and one
  set of LiveKit/Postgres ports (`HOME_DEPLOY.md`), so there's no second environment
  to deploy it to. Merging to `dev` only runs `.github/workflows/ci.yml`.
* Merging to `master` triggers `.github/workflows/cd-production.yml`, which redeploys
  this same PC's production stack.

## Why a self-hosted runner instead of SSH from GitHub-hosted runners

Production already runs on this PC (`HOME_DEPLOY.md`), not a VPS. A self-hosted
runner installed here pulls jobs over an outbound connection to GitHub — no inbound
SSH port needs to be opened on the router, and no `DEPLOY_SSH_KEY`/`DEPLOY_HOST`
secrets are needed. The runner already has local Docker access and can read
`infrastructure/.env` directly, so `cd-production.yml` and `rollback-production.yml`
need **zero** GitHub Secrets.

## One-time runner setup

1. GitHub repo → Settings → Actions → Runners → "New self-hosted runner", choose
   Linux/Windows to match this PC, and follow the generated `config.sh`/`config.cmd`
   command — it embeds a one-time registration token that can't be scripted ahead of
   time.
2. Install it as a service (`./svc.sh install && ./svc.sh start` on Linux/WSL, or the
   equivalent Windows service option) so it survives reboots.
3. The runner's own job workspace (normally `_work/concord-mvp/concord-mvp`) becomes
   the new canonical clone for production — copy the existing
   `infrastructure/.env` from whatever directory `HOME_DEPLOY.md` had you deploy from
   into `_work/concord-mvp/concord-mvp/infrastructure/.env` once. Every workflow run
   uses `actions/checkout` with `clean: false` specifically so this file survives
   across runs.
4. Confirm Docker and the Compose plugin are reachable by whichever user account the
   runner service runs as (same prerequisite `HOME_DEPLOY.md` already lists).

## Branch protection

Configure on `dev` and `master` (GitHub repo → Settings → Branches):

* Require a pull request before merging, with at least 1 approval.
* Require status checks to pass: the `frontend`, `backend`, and `infra-validate`
  jobs from `ci.yml`.
* Do not allow direct pushes (including for admins, if the team is comfortable with
  that).

## Rollback

Actions tab → "Rollback Production" → Run workflow → enter the commit SHA to roll
back to. This checks out that commit (code **and** compose config together, not just
an old image tag) and redeploys, so infra config from that point in history is
guaranteed to match the code that shipped with it.

Images are also tagged locally as `concord-backend:<short-sha>` /
`concord-frontend:<short-sha>` after every healthy deploy (last 5 kept) — this is for
traceability only; the rollback workflow itself always rebuilds from git rather than
reusing a cached tag, so a stale image can never mask a config drift.

## Traceability

Every run in the Actions tab already shows the triggering commit, branch, author,
timestamp, and the result of each job (tests, build, deploy, health check) — nothing
extra to configure for this.
