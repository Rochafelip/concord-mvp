# OPEN_QUESTIONS.md

# Architecture & Product Open Questions

This document contains decisions that have not yet been finalized.

These questions must be answered before the corresponding functionality is implemented.

## Rules

* Do not assume an answer when one has not been provided.
* Do not implement functionality based solely on speculation.
* When a question is answered, move the decision to `DECISIONS.md`.
* Update `PRODUCT.md`, `ARCHITECTURE.md`, `TECH_STACK.md` or `DATABASE.md` when the decision changes their contents.
* Remove answered questions from this document or mark them as resolved.
* The AI agent must ask before making a decision that materially changes the architecture or product scope.

---

# 1. Authentication

## Q1 — JWT expiration

**Status:** ✅ Resolved — see `DECISIONS.md` D2.

The current proposal is a single long-lived JWT without refresh tokens.

Possible options:

* [x] 30-day JWT
* [ ] 7-day JWT
* [ ] 1-day JWT
* [ ] Other: __________________

### Question

Are we intentionally accepting the security trade-off of a long-lived JWT for the sake of implementation simplicity?

**Decision:**

> Yes. 30-day JWT, no refresh token. Decided as part of D2 (friends-only
> audience, prioritizing low implementation effort).

---

# 2. Infrastructure

## Q2 — Single VM architecture

**Status:** ✅ Resolved — see `DECISIONS.md` D9, `ARCHITECTURE.md` §31, `TECH_STACK.md` §29.

The proposed initial deployment is:

```text
Single Linux VM
        |
        +-- Nginx
        +-- Frontend
        +-- Spring Boot
        +-- PostgreSQL
        +-- LiveKit
        +-- Coturn
```

### Question

Should all initial services run on the same VM using Docker Compose?

* [x] Yes
* [ ] No

If no, describe the desired separation:

>

---

# 3. Redis

## Q3 — Redis in the MVP

**Status:** ✅ Resolved — see `DECISIONS.md` D3.

Current proposal:

```text
No Redis
```

Presence and other temporary state can live in backend memory.

### Question

Do we confirm that Redis is completely excluded from the initial MVP?

* [x] Yes
* [ ] No

If no, explain what Redis is required for:

>

---

# 4. Server Invitations

## Q4 — Invite persistence model

**Status:** ✅ Resolved — see `DECISIONS.md` D6.

The MVP needs reusable server invitation links/codes.

Two possible implementations:

### Option A — Code directly on `servers`

```text
servers
├── id
├── name
├── owner_id
└── invite_code
```

One active invitation per server.

### Option B — Dedicated `server_invites`

```text
server_invites
├── id
├── server_id
├── code
└── created_at
```

Allows future invitation history and multiple active invitations.

### Question

Which model should the MVP use?

* [ ] Option A — `invite_code` directly on `servers`
* [x] Option B — `server_invites` table

**Decision:**

> Option B, per D6. Chosen over Option A specifically so regeneration (Q5)
> can be handled cleanly later without an awkward migration.

---

# 5. Invitation Security

## Q5 — Invite code regeneration

**Status:** ✅ Resolved — see `DECISIONS.md` D10.

Current proposal:

```text
Server owner
      |
      +-- Regenerate invite
              |
              v
       Old code becomes invalid
```

### Question

Should regenerating the invite immediately invalidate the previous invite?

* [x] Yes
* [ ] No

**Decision:**

> Yes. One active code per server (`UNIQUE (server_id)` on
> `server_invites`); regenerating updates the existing row.

---

# 6. Server Ownership

## Q6 — Ownership transfer

**Status:** ✅ Resolved — see `DECISIONS.md` D7.

Current proposal:

```text
Owner
  |
  +-- Transfer ownership
          |
          v
   Existing server member
```

The previous owner remains a member.

### Question

Should ownership only be transferable to an existing server member?

* [x] Yes
* [ ] No

**Decision:**

> Yes, per D7. Transfer target must already be a member of the server; the
> previous owner remains a regular member afterward.

---

# 7. Server Deletion

## Q7 — What happens when a server is deleted?

**Status:** ✅ Resolved — see `DECISIONS.md` D11.

Current proposal:

```text
Delete Server
      |
      +-- Delete Messages
      |
      +-- Delete Channels
      |
      +-- Delete Members
      |
      +-- Delete Invite
      |
      +-- Delete Server
```

All operations happen inside a transaction.

### Question

Should server deletion permanently remove all associated data?

* [x] Yes
* [ ] No
* [ ] Soft delete instead

**Decision:**

> Yes, hard delete. Messages, channels, members and invite code are
> deleted along with the server, all in one transaction. No soft delete.

---

# 8. Server Owner Leaving

## Q8 — Owner leaving a server

**Status:** ✅ Resolved — see `DECISIONS.md` D7, `PRODUCT.md` §7.4.

Possible behavior:

### Option A

Owner must transfer ownership before leaving.

### Option B

Owner cannot leave at all.

### Option C

Ownership automatically transfers to another member.

### Option D

Other:

>

### Question

What should happen when the server owner attempts to leave?

**Decision:**

> Option A. The owner must either transfer ownership (D7) to another
> existing member first, or delete the server, before leaving. No automatic
> transfer (Option C) — that would pick a new owner without consent.

---

# 9. Presence

## Q9 — Online/offline status

**Status:** ✅ Resolved — see `DECISIONS.md` D12.

Possible MVP implementation:

```text
WebSocket connected
        ↓
ONLINE

WebSocket disconnected
        ↓
OFFLINE
```

No Redis and no distributed presence system.

### Question

Is simple online/offline presence enough for the MVP?

* [ ] Yes
* [x] No — not needed at all

If no, what additional states are required?

```text
None. No global presence system in the initial MVP.
```

**Decision:**

> No global presence system. Who is "present" is only visible per voice
> channel, via LiveKit's own participant list — the app gets this for free
> without building anything.

---

# 10. Presence Disconnect

## Q10 — Abrupt disconnect

**Status:** ✅ Resolved — moot, see `DECISIONS.md` D12.

If a browser crashes, loses internet connection or closes unexpectedly, the backend may not immediately receive a clean disconnect.

Possible approaches:

### Option A

Trust WebSocket disconnect events.

### Option B

Use WebSocket heartbeat/ping-pong.

### Option C

Use a timeout after missed heartbeats.

### Question

How should the MVP determine that a user is offline?

**Decision:**

> N/A — no app-wide online/offline state is tracked (D12), so there is
> nothing to detect. Whether someone is actively in a voice channel is
> LiveKit's own connection state, not something this app tracks separately.

---

# 11. Real-Time Architecture

## Q11 — WebSocket responsibility

**Status:** ✅ Resolved — see `ARCHITECTURE.md` §16, `TECH_STACK.md` §11, `AGENTS.md` "WebSocket Rules".

Proposed architecture:

```text
WebSocket
    ↓
Application events

WebRTC / LiveKit
    ↓
Audio
Video
Screen sharing
```

### Question

Do we explicitly prohibit using WebSocket as a transport for audio, video or screen frames?

* [x] Yes
* [ ] No

Recommended:

* Yes

**Decision:**

> Yes — already a hard rule in the base documentation, not just a
> recommendation.

---

# 12. Message Persistence

## Q12 — Message delivery order

**Status:** ✅ Resolved — see `ARCHITECTURE.md` §18, `DATABASE.md` §34.

Proposed flow:

```text
Client
   ↓
Backend
   ↓
Validate
   ↓
Persist PostgreSQL
   ↓
Commit
   ↓
Broadcast WebSocket event
```

### Question

Should a message only be broadcast as successfully created after PostgreSQL persistence succeeds?

* [x] Yes
* [ ] No

Recommended:

* Yes

**Decision:**

> Yes — already specified in ARCHITECTURE.md and DATABASE.md as the
> message creation transaction flow.

---

# 13. WebSocket Failure

## Q13 — Message persistence succeeds but WebSocket fails

**Status:** ✅ Resolved.

Example:

```text
Message
   ↓
PostgreSQL succeeds
   ↓
WebSocket broadcast fails
```

The message exists in the database but one or more clients did not receive the event.

### Question

Should clients rely on message history synchronization/re-fetching to recover missed messages?

* [x] Yes
* [ ] No

### Recommended approach

Yes.

The database remains the source of truth.

**Decision:**

> Yes, adopting the recommended approach. Consistent with "PostgreSQL is
> the source of truth" (DATABASE.md §1, §45) — no separate delivery
> guarantee/retry mechanism is built for the WebSocket layer itself.

---

# 14. LiveKit

## Q14 — Media implementation

**Status:** ✅ Resolved — see `ARCHITECTURE.md` §19-22, `TECH_STACK.md` §20.

Proposed architecture:

```text
Browser
   |
   | WebRTC
   v
LiveKit
   |
   +-- Audio
   +-- Video
   +-- Screen sharing
```

The backend generates authorized LiveKit tokens.

### Question

Do we confirm that LiveKit is mandatory for the MVP media layer?

* [x] Yes
* [ ] No

If no, describe the alternative:

>

---

# 15. LiveKit Room Naming

## Q15 — Application channel ↔ LiveKit room

**Status:** ✅ Resolved (default adopted; can be revisited during implementation without a product-level discussion).

A voice channel needs to correspond to a LiveKit room.

Possible approach:

```text
voice-channel-{channelId}
```

or another deterministic identifier.

### Question

Should the LiveKit room identifier be deterministically derived from the application voice channel ID?

* [x] Yes
* [ ] No

If no, describe the desired mapping:

>

**Decision:**

> Yes — LiveKit room name = `voice-channel-{channelId}` (the channel's own
> UUID). This is a low-stakes implementation detail, not an architectural
> trade-off, so no separate DECISIONS.md entry.

---

# 16. Media Authorization

## Q16 — Who can join a voice channel?

**Status:** ✅ Resolved — see `ARCHITECTURE.md` §28.

Proposed rule:

```text
Authenticated user
        |
        ↓
Server membership
        |
        ↓
Channel access
        |
        ↓
LiveKit token
        |
        ↓
Join media session
```

### Question

Should the backend validate server/channel access before issuing a LiveKit token?

* [x] Yes
* [ ] No

Recommended:

* Yes

**Decision:**

> Yes — already a hard rule in ARCHITECTURE.md §28 ("Media Authorization").

---

# 17. Screen Sharing

## Q17 — Screen-sharing limits

**Status:** ✅ Resolved — see `DECISIONS.md` D13.

Possible MVP behavior:

* One user can share their screen at a time.
* Multiple users can share simultaneously.
* No artificial limit.

### Question

How many simultaneous screen shares should a voice channel support?

**Decision:**

> No artificial limit. LiveKit already supports multiple simultaneous
> shares; no extra bookkeeping/locking logic is added.

---

# 18. Video

## Q18 — Camera limits

**Status:** ✅ Resolved — see `DECISIONS.md` D13.

Possible MVP behavior:

* Everyone can enable camera.
* Limit number of active cameras.
* No artificial application-level limit.

### Question

Should the application impose a limit on simultaneous cameras?

**Decision:**

> No. Same reasoning as Q17 — LiveKit handles it, no artificial limit
> added.

---

# 19. Testing

## Q19 — Initial testing scope

**Status:** ✅ Resolved — see `DECISIONS.md` D4.

Current proposal:

```text
Backend
    JUnit
    Mockito

Frontend
    Vitest
    React Testing Library

No Testcontainers initially
No Playwright initially
```

### Question

Do we confirm this testing strategy for the MVP?

* [x] Yes
* [ ] No

If no, what should be added?

>

---

# 20. CI/CD

## Q20 — Continuous Integration

**Status:** ✅ Resolved — see `DECISIONS.md` D5.

Current proposal:

```text
GitHub Actions
    |
    +-- Frontend lint
    +-- Frontend test
    +-- Frontend build
    |
    +-- Backend build
    +-- Backend test
```

Deployment remains manual initially.

### Question

Should CI be implemented before the first production deployment?

* [x] Yes
* [ ] No

**Decision:**

> Yes — D5 already sets up CI early, before any implementation begins, so
> this is satisfied by construction.

---

# 21. File Attachments

## Q21 — Attachments

**Status:** ✅ Resolved — see `AGENTS.md` "Explicitly Out of Scope".

Discord-like systems commonly support:

* Images
* Videos
* Documents
* Other files

### Question

Are file attachments part of this MVP?

* [ ] Yes
* [x] No
* [ ] Only images

If yes, what is the maximum file size?

>

Where should files be stored?

* [ ] Local VM storage
* [ ] S3-compatible storage
* [ ] Other: __________________

**Decision:**

> No. "File uploads" is explicitly listed as out of scope in AGENTS.md.

---

# 22. Message Editing

## Q22 — Editing messages

**Status:** ✅ Resolved — see `PRODUCT.md` §9.6 and §19.

### Question

Can users edit messages in the initial MVP?

* [ ] Yes
* [x] No

If yes:

* Who can edit?
* Author only?
* Server owner?
* Admin?

**Decision:**

> No. PRODUCT.md §9.6 states message editing is not required for the
> initial MVP, and it's listed under MVP Non-Goals (§19).

---

# 23. Message Deletion

## Q23 — Deleting messages

**Status:** ✅ Resolved — see `PRODUCT.md` §9.7 and §19.

### Question

Can users delete messages in the initial MVP?

* [ ] Yes
* [x] No

If yes:

Who can delete?

* [ ] Author
* [ ] Server owner
* [ ] Admin
* [ ] Other

**Decision:**

> No. PRODUCT.md §9.7 states message deletion is not required for the
> initial MVP, and it's listed under MVP Non-Goals (§19). Per DATABASE.md
> §20, no soft-delete column should be added until this becomes a real
> requirement.

---

# 24. Usernames

## Q24 — Username uniqueness

**Status:** ✅ Resolved — see `DECISIONS.md` D14.

Possible approaches:

### Option A

Username must be globally unique.

### Option B

Username does not need to be unique; user ID distinguishes accounts.

### Question

Should usernames be globally unique?

**Decision:**

> Option B. `users.id` (UUID) distinguishes accounts; `username` has no
> `UNIQUE` constraint.

---

# 25. User Identity

## Q25 — User display identity

**Status:** ✅ Resolved — see `DECISIONS.md` D14.

Should users have:

```text
username
display_name
```

or only:

```text
username
```

### Question

Do we need a separate `display_name` in the MVP?

* [x] Yes
* [ ] No

**Decision:**

> Yes. `users.display_name` added alongside `username` (see DATABASE.md
> §6). `display_name` is what's shown in the UI; `username` is the login
> identifier. Neither is unique except by `id`.

---

# 26. Server Roles

## Q26 — Roles and permissions

**Status:** ✅ Resolved — see `PRODUCT.md` §15, `AGENTS.md` "Explicitly Out of Scope".

The simplest MVP can have:

```text
OWNER
MEMBER
```

A more complex model could introduce:

```text
OWNER
ADMIN
MODERATOR
MEMBER
```

### Question

Should the MVP have roles beyond owner/member?

* [ ] Yes
* [x] No

If yes:

>

**Decision:**

> No. PRODUCT.md §15 only defines unauthenticated/authenticated/owner
> permission levels, and "Advanced roles" / "Advanced permissions" are
> explicitly out of scope in AGENTS.md.

---

# 27. Direct Messages

## Q27 — Private messages

**Status:** ✅ Resolved — see `AGENTS.md` "Explicitly Out of Scope", `PRODUCT.md` §19.

### Question

Does the MVP include direct messages between users?

* [ ] Yes
* [x] No

Recommended:

* No, unless explicitly required.

**Decision:**

> No. Explicitly out of scope in both AGENTS.md and PRODUCT.md §19.

---

# 28. Friend System

## Q28 — Friends

**Status:** ✅ Resolved — see `PRODUCT.md` §19.

### Question

Does the MVP include:

```text
Friend requests
Friends list
Friend removal
```

* [ ] Yes
* [x] No

Recommended:

* No.

**Decision:**

> No. Listed under MVP Non-Goals in PRODUCT.md §19 ("Social").

---

# 29. Notifications

## Q29 — Notifications

**Status:** ✅ Resolved — see `AGENTS.md` "Explicitly Out of Scope".

### Question

Does the MVP require notifications?

Possible scope:

* [ ] Browser notifications
* [ ] In-app notifications
* [ ] Mentions only
* [x] No notifications

**Decision:**

> No. "Notifications" is explicitly out of scope in AGENTS.md.

---

# 30. Mobile

## Q30 — Mobile support

**Status:** ✅ Resolved — see `PRODUCT.md` §18.

The initial frontend is a web application.

### Question

Should the MVP be:

* [x] Desktop-first responsive web
* [ ] Fully responsive desktop/mobile
* [ ] Desktop only

**Decision:**

> Desktop-first responsive. PRODUCT.md §18: should work on desktop/tablet/
> mobile browser, but desktop is the primary target and communication
> usability takes priority over mobile-specific optimization.

---

# 31. Final MVP Boundary

## Q31 — What absolutely must work?

**Status:** ✅ Resolved — matches `PRODUCT.md` §20 ("MVP Success Criteria").

Before implementation begins, define the minimum experience that makes the MVP successful.

The expected core flow is currently:

```text
Register
    ↓
Login
    ↓
Create Server
    ↓
Generate Invite
    ↓
Another User Joins
    ↓
Create / Access Channel
    ↓
Send Text Messages
    ↓
Join Voice Channel
    ↓
Enable Microphone
    ↓
Enable Camera
    ↓
Share Screen
```

### Question

Is this the complete definition of the MVP's critical path?

* [x] Yes
* [ ] No

If no, add/remove steps:

>

**Decision:**

> Yes. This is a condensed version of the two-user scenario already
> defined in PRODUCT.md §20 — same steps, same order, nothing added or
> removed.

---

# 32. Definition of Done

## Q32 — When is the MVP considered complete?

**Status:** ✅ Resolved — see `AGENTS.md` "Definition of Done".

Possible criteria:

```text
[ ] Authentication works
[ ] Multiple servers work
[ ] Server invites work
[ ] Text channels work
[ ] Real-time messaging works
[ ] Voice works
[ ] Video works
[ ] Screen sharing works
[ ] Basic authorization works
[ ] Application can be deployed to the VM
[ ] CI passes
```

### Question

What additional conditions must be met before calling the MVP complete?

> No additional conditions. This checklist is the functional subset of
> AGENTS.md's existing "Definition of Done" section (feature implemented,
> existing functionality still works, tests pass, no obvious security
> issue, documentation updated, roadmap updated). Nothing extra is being
> added — production concerns like backups/monitoring stay lower priority
> per D1 (friends group, not a product).

---

# Answering This Document

Answer each question directly under its `Decision:` field.

Example:

```text
## Q1 — JWT expiration

Decision:

30 days. We accept the security trade-off because this is a private
friends-only application.
```

Once a question is answered:

1. Add the finalized decision to `DECISIONS.md`.
2. Update any affected documentation.
3. Mark the question as resolved or remove it.
4. Do not leave conflicting information in other documentation files.
