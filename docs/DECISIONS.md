# DECISIONS.md

# Architecture Decisions

This document records significant architectural decisions and the reasoning
behind them, as referenced by AGENTS.md and ARCHITECTURE.md (Section 36).

If a decision here conflicts with PRODUCT.md, ARCHITECTURE.md, TECH_STACK.md
or DATABASE.md, this document wins for the specific point it covers — the
other documents have been updated to stay consistent where practical.

---

## D1 — Target audience: friends group, not a product

Date: 2026-09-01

**Context**: The MVP is built for a single group of friends to use for their
own communication, not to become a public product or handle unknown scale.

**Decision**: Optimize the MVP for lowest implementation effort rather than
production-grade robustness, as long as it doesn't compromise the core
real-time experience (text, voice, video, screen sharing) or basic security
(no plaintext passwords, no unauthenticated access to servers/channels).

**Consequences**: Several requirements originally written for a
general-audience product are relaxed. See D2–D6 below. Any of these can be
revisited later if the project's audience or goals change.

---

## D2 — Authentication: single long-lived JWT, no refresh token

**Context**: A full access+refresh token flow (rotation, revocation,
refresh endpoint) is real implementation effort and mainly pays off when
you need short-lived access tokens for a large, semi-trusted user base.

**Decision**: Use a single JWT access token with a long expiry (e.g. 30
days). No refresh token, no refresh endpoint, no server-side revocation
list. Logout simply discards the token client-side; the token remains
technically valid until it expires.

**Consequences**: Simpler auth implementation (no token rotation/blacklist
logic). Trade-off: a stolen token stays valid until expiry with no way to
revoke it early. Acceptable for a small, trusted group of friends.

Supersedes: AGENTS.md "Authentication" scope item "Refresh tokens".

---

## D3 — Redis removed from the initial MVP

**Context**: Redis was planned for temporary/coordination state (presence,
rate limiting, pub/sub across instances). The deployment target is a single
VM running a single backend instance, so there is no multi-instance
coordination problem to solve yet.

**Decision**: Do not deploy Redis in the initial MVP. Any state that would
have used Redis (e.g. who is currently online) lives in memory in the
single backend instance (e.g. a `ConcurrentHashMap`).

**Consequences**: One fewer service in Docker Compose and one fewer
integration to build/maintain. In-memory state is lost on backend restart
and does not survive a future move to multiple backend instances — Redis
should be reintroduced at that point, not before.

Supersedes: TECH_STACK.md / ARCHITECTURE.md treating Redis as part of the
initial deployed stack.

---

## D4 — Lighter testing strategy initially

**Context**: Testcontainers (real Postgres per integration test) and
Playwright E2E add real setup and run-time cost. That investment pays off
more for a product with ongoing external contributors and regression risk
than for a small friends project.

**Decision**: Initial MVP testing is:

* Backend — JUnit + Mockito unit tests on business logic (services). No
  Testcontainers for now; use mocks or H2 in-memory where a repository test
  is actually needed.
* Frontend — Vitest + React Testing Library on the most important
  components/hooks.
* No Playwright E2E suite for now.

**Consequences**: Faster to write, faster to run, less confidence against
integration-level bugs (real Postgres behavior, real browser flows).
Testcontainers and/or Playwright can be introduced later if bugs in those
areas start showing up, without needing to change this decision — just
extend the suite.

Supersedes: AGENTS.md / TECH_STACK.md "Testing Rules" mandating
Testcontainers and Playwright from the start.

---

## D5 — CI/CD set up from the start, despite lighter testing

**Context**: Even with a lighter test suite, an automated pipeline still
catches lint/build/test failures before they land, and is cheap to set up
with GitHub Actions.

**Decision**: Set up GitHub Actions early: lint + build + the tests defined
in D4, running on push/PR for both frontend and backend. No automated
deployment yet — deploy stays manual until the project is stable enough to
be worth automating.

**Consequences**: Slightly more setup effort up front than skipping CI
entirely, in exchange for catching regressions early throughout
development.

---

## D6 — Server invites: reusable code/link, no expiration or usage limit

**Context**: PRODUCT.md and DATABASE.md left the invite mechanism
unspecified on purpose ("implementation may be defined during
development").

**Decision**: Each server has one reusable invite code/link
(`server_invites` table: server_id, code, created_at). No expiration date,
no usage-count limit for the initial MVP.

**Consequences**: Minimal implementation — no expiry scheduling, no usage
tracking/enforcement logic. If a code needs to be invalidated (e.g. it
leaked), regenerating a new code for the server is the escape hatch.
Expiration/usage limits can be added later as a real requirement, not a
speculative one.

---

## D7 — Server ownership: simple transfer allowed

**Context**: PRODUCT.md states the owner cannot leave without transferring
ownership or deleting the server, and asks to keep this simple.

**Decision**: Add a simple "transfer ownership" action that changes
`servers.owner_id` to another existing member of the server. No transfer
history is stored.

**Consequences**: Owner is not forced to delete the server just to stop
being responsible for it. Slightly more implementation than "owner can only
delete", but avoids destroying a server just because the owner wants out.

---

## D8 — Multiple servers per user kept as originally scoped

**Context**: Considered collapsing the "servers" concept entirely into one
fixed shared space, since the audience is a single friend group.

**Decision**: Keep the original multi-server model (create/join/leave
multiple servers) — the group wants the ability to use this for more than
one context, not just a single fixed space.

**Consequences**: No scope reduction here; this decision exists mainly to
record that the simplification was considered and explicitly rejected, so
it isn't reconsidered later without reason.

---

## D9 — Infrastructure stays fully self-hosted

**Context**: Considered using managed services (LiveKit Cloud, managed
Postgres) to cut infrastructure setup effort.

**Decision**: Keep the original self-hosted plan — Docker Compose with
Postgres, LiveKit, Coturn, Nginx on a single VM, as already defined in
ARCHITECTURE.md and TECH_STACK.md.

**Consequences**: No change to the original infrastructure plan. This
decision exists to record that managed alternatives were considered and
declined, in case it comes up again later.

---

## D10 — Invite code regeneration invalidates the previous code

**Context**: D6 left open whether regenerating a server's invite code
should invalidate the old one. Resolves OPEN_QUESTIONS.md Q5.

**Decision**: A server has exactly one active invite code at a time.
Regenerating replaces it — the previous code stops working immediately.
Implementation-wise, `server_invites` holds one row per server and
regeneration is an `UPDATE`, not an `INSERT` of a new row.

**Consequences**: Simplest possible model — no need to track multiple
valid codes or their history. If a code leaks, regenerating is the fix.

---

## D11 — Server deletion cascades (hard delete)

**Context**: DATABASE.md §26 said cascades must be intentional and not
automatic. Resolves OPEN_QUESTIONS.md Q7: what happens to a server's data
when it is deleted.

**Decision**: Deleting a server hard-deletes its channels, messages,
members and invite code, all inside a single transaction. No soft delete.

**Consequences**: No orphaned data, no `deleted_at` columns to filter
around. This is a deliberate, explicit cascade for the `servers` deletion
path specifically — it does not change the general rule against automatic
`ON DELETE CASCADE` for other relationships.

---

## D12 — No global online/offline presence system

**Context**: Resolves OPEN_QUESTIONS.md Q9/Q10. Considered tracking
app-wide online/offline status via WebSocket connections.

**Decision**: The MVP does not implement a general online/offline presence
system. Who is "present" is only visible at the voice-channel level, via
LiveKit's own participant list — which the app gets for free by using
LiveKit.

**Consequences**: No in-memory connection tracking, no heartbeat/timeout
logic, no `ONLINE`/`OFFLINE` state to maintain or broadcast. If app-wide
presence becomes a real requirement later, it can be added independently.

---

## D13 — No artificial limit on simultaneous screen shares or cameras

**Context**: Resolves OPEN_QUESTIONS.md Q17 and Q18.

**Decision**: The application does not impose a limit on how many
participants in a voice channel can share their screen or have their
camera on at once. LiveKit handles this natively.

**Consequences**: No extra bookkeeping/locking logic in the backend or
frontend for this. For a small friends group this is not expected to be a
real problem; revisit only if it becomes one in practice.

---

## D14 — Username is not globally unique; display_name is a separate field

**Context**: Resolves OPEN_QUESTIONS.md Q24 and Q25.

**Decision**: `username` does not need to be unique across the system —
`users.id` (UUID) is what distinguishes accounts. A separate `display_name`
column is added to `users` for the name shown in the UI, independent of
`username`.

**Consequences**: `DATABASE.md` users table gains a `display_name` column
(required, no uniqueness constraint — same as `username`). No `UNIQUE`
constraint is added on `username`, unlike `email`, which stays unique.
