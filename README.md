# Discord MVP

A minimal real-time communication platform inspired by Discord.

The project focuses on the core experience of real-time text, voice, video and screen sharing while intentionally keeping the product scope small.

---

## MVP

The MVP centers on:

### 💬 Real-Time Text Chat

* Servers
* Text channels
* Real-time messaging
* Message persistence
* File attachments (up to 10 per message, 150 MB each) — images and PDFs preview inline, every other type downloads as a file chip
* Unread message tracking per channel
* Visual indicators for channels with unread messages
* Mark channels as read functionality

### 🔒 Roles & Permissions

* Per-server roles with a position-based hierarchy, plus a non-deletable `@everyone` role
* Members can hold multiple roles; effective permissions are the union of all of them
* 23 permissions as a bitfield, enforced centrally by `PermissionService`
* Per-channel overrides for a role or a single user
* Role management UI in server settings (per-channel overrides do not have a UI yet)

### 🎤 Voice

* Voice channels
* Join/leave voice channels
* Microphone mute/unmute
* Private "whistle" — hold a key over a participant's tile to make your mic audible to just them

### 📹 Video

* Camera on/off
* Multiple participants
* Real-time video
* Pop calls out into a Picture-in-Picture window

### 🖥️ Screen Sharing

* Start screen sharing
* Stop screen sharing
* View shared screens

### 👥 Friends & Direct Messages

* Friend requests, friends list, friend removal
* 1:1 text conversations outside of servers
* 1:1 voice/video calls between friends

> **Scope note:** this area was implemented as an explicit, owner-approved
> addition to the original MVP — see `docs/DECISIONS.md` D25 and
> `docs/PRODUCT.md` §24.

Authentication (registration, login, logout, password recovery via e-mail) and server/channel management are also included.

---

## Screenshots

Mockups of every screen in the app, drafted with Claude Design to match the app's current UI. These predate the Roles & Permissions and Friends/DM features above and have not been refreshed to include them.

### Log in

![Log in screenshot](docs/screenshots/login.png)

### Register

![Register screenshot](docs/screenshots/register.png)

### Text channel

![Text channel screenshot](docs/screenshots/text-channel.png)

### No channel selected

![No channel selected screenshot](docs/screenshots/empty-state.png)

### Voice channel — camera grid and screen sharing

![Voice channel screenshot](docs/screenshots/voice-channel.png)

### Create a server

![Create server modal screenshot](docs/screenshots/create-server-modal.png)

### Join a server

![Join server modal screenshot](docs/screenshots/join-server-modal.png)

### Create a channel

![Create channel modal screenshot](docs/screenshots/create-channel-modal.png)

### Server settings — invite code and members

![Server settings modal screenshot](docs/screenshots/server-settings-modal.png)

---

## Architecture

The project is organized as a monorepo.

```text
discord-mvp/
│
├── frontend/              # React web application
├── backend/               # Spring Boot API
├── infrastructure/        # Docker and infrastructure configuration
├── docs/                  # Architecture and project documentation
├── AGENTS.md              # AI development instructions
└── README.md
```

High-level architecture:

```text
                         Internet
                             |
                         HTTPS / WSS
                             |
                           Nginx
                             |
                  +----------+----------+
                  |                     |
              Frontend               Backend
               React               Spring Boot
                                       |
                    +------------------+----------------+
                    |                  |                |
                PostgreSQL           Redis          LiveKit
                                                         |
                                                       WebRTC
                                                         |
                                      +------------------+----------------+
                                      |                  |                |
                                    Audio              Video           Screen
```

Redis is deferred (see `docs/DECISIONS.md` D3) and is not deployed yet — it
does not appear in `infrastructure/docker-compose.yml`. Temporary/coordination
state lives in backend memory until a real need for cross-instance
coordination exists.

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* TanStack Query
* Zustand

### Backend

* Java 21
* Spring Boot
* Spring Security
* Spring Web
* Spring WebSocket
* Spring Data JPA
* Hibernate
* Flyway

### Data

* PostgreSQL — source of truth for persistent application data
* Redis — deferred, not deployed yet (see `docs/DECISIONS.md` D3)

### Real-Time Communication

* WebSocket for application events
* WebRTC for media
* LiveKit as the SFU, including its embedded TURN server (see docs/DECISIONS.md D16 — no
  standalone Coturn service)

### Infrastructure

* Docker
* Docker Compose
* Nginx
* Linux VM or self-hosted PC (router port-forwarding), with DuckDNS + Let's Encrypt for a real TLS certificate on the home-PC path

---

## Communication Model

The application uses different technologies for different types of communication.

### Text and Application Events

```text
React
  |
  | WebSocket
  |
Spring Boot
  |
  +---- PostgreSQL
```

WebSocket is responsible for application-level real-time events.

Examples:

```text
MESSAGE_CREATE
MESSAGE_UPDATE
MESSAGE_DELETE
CHANNEL_CREATE
CHANNEL_UPDATE
```

### Voice, Video and Screen Sharing

```text
Client
  |
  | WebRTC
  |
LiveKit SFU
  |
  +---- Participant
  +---- Participant
  +---- Participant
```

Audio, video and screen sharing are not transmitted through the application WebSocket.

---

## Project Principles

### Keep the MVP Small

The project intentionally avoids non-essential Discord features.

### Prefer Simplicity

The simplest solution that satisfies the requirement should be preferred.

### Modular Monolith

The backend is a modular monolith.

Microservices are not required for the MVP.

### Use Existing Infrastructure

WebRTC media infrastructure is provided by LiveKit instead of being implemented from scratch.

### Documentation Is Part of the Project

Architectural decisions and important contracts must be documented under `/docs`.

---

## Development

### Prerequisites

Recommended development environment:

* Git
* Docker
* Docker Compose
* Java 21
* Node.js
* npm

---

## Local Development

Clone the repository:

```bash
git clone <repository-url>
cd discord-mvp
```

Start infrastructure:

```bash
docker compose up -d
```

Start the backend:

```bash
cd backend
./mvnw spring-boot:run
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The exact commands may evolve as the project is implemented.

---

## Docker Commands

The full stack (frontend, backend, PostgreSQL, LiveKit, Nginx) runs via Docker Compose from the `infrastructure/` directory. For the complete deployment runbooks (router port-forwarding, TLS certificates, `.env` setup), see [`infrastructure/HOME_DEPLOY.md`](infrastructure/HOME_DEPLOY.md) (self-hosted PC, no domain), [`infrastructure/DUCKDNS.md`](infrastructure/DUCKDNS.md) (self-hosted PC with a free DuckDNS hostname and a real Let's Encrypt certificate), [`infrastructure/DEPLOY.md`](infrastructure/DEPLOY.md) (VPS with a domain and Let's Encrypt), or [`infrastructure/VM_REVIEW.md`](infrastructure/VM_REVIEW.md) (quick review deployment behind a Cloudflare Quick Tunnel, no router config needed). Transactional e-mail (registration confirmation, password recovery) is documented in [`infrastructure/EMAIL.md`](infrastructure/EMAIL.md). Production deploys are automated after merging to `master` — see [`infrastructure/CI_CD.md`](infrastructure/CI_CD.md) for the branch/CI/CD flow, the self-hosted runner setup, and rollback.

Start the stack:

```bash
cd infrastructure
docker compose up -d
```

Deploy a new version (pull the latest code, rebuild the changed images, and recreate only the containers that changed):

```bash
git pull
cd infrastructure
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

View logs (all services, or a single one):

```bash
docker compose logs -f
docker compose logs -f frontend
```

Stop the stack:

```bash
docker compose down
```

---

## Documentation

Project documentation is maintained under `/docs`:

```text
docs/
├── PRODUCT.md               # Product definition, goals, and MVP non-goals
├── ARCHITECTURE.md          # System architecture
├── TECH_STACK.md            # Technology choices
├── DATABASE.md              # Schema and data rules
├── DECISIONS.md             # Numbered architecture decision records (D1, D2, ...)
├── OPEN_QUESTIONS.md        # Resolved and pending product/architecture questions
├── UNREAD_MESSAGES_SPEC.md  # Unread tracking spec
├── security-audit-2026-09-18.md
└── screenshots/
```

Further documents are added progressively as the corresponding parts of the system are implemented.

---

## Development Roadmap

### Phase 1 — Foundation ✅

* Authentication
* Users
* Servers
* Channels
* Text chat
* WebSocket communication

### Phase 2 — Voice ✅

* LiveKit integration
* Voice channels
* Microphone controls

### Phase 3 — Video ✅

* Camera
* Video participants
* Video layout

### Phase 4 — Screen Sharing ✅

* Screen capture
* Screen publishing
* Screen viewing

### Phase 5 — Roles, Attachments, Friends & Calls ✅

* Roles and per-channel permissions
* Message file attachments
* Friend system and 1:1 direct messages (scope addition — see the note under "Friends & Direct Messages" above)
* 1:1 voice/video calls between friends, call Picture-in-Picture, private whistle

### Phase 6 — MVP Release

* Production configuration ✅ (self-hosted PC, DuckDNS + Let's Encrypt TLS)
* HTTPS ✅
* Automated deployment ✅ (CI/CD via self-hosted runner on merge to `master`)
* Monitoring — not started
* Database backup — not started

---

## Current Status

🚧 Early development — Phases 1–5 complete (text chat, voice, video, screen sharing, roles/permissions, attachments, friends/DMs/calls). Phase 6 hardening (monitoring, database backups) remains; deployment is already automated for both the home-PC and VPS paths.

The project is currently being established and the architecture is intentionally being built incrementally.

---

## License

To be defined.
