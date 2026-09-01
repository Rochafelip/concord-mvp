# AGENTS.md

## Project Overview

This repository contains a Discord-inspired real-time communication platform MVP.

The goal is to build a focused MVP around the core communication experience:

* User authentication
* Servers
* Text channels
* Real-time text chat
* Voice communication
* Video communication
* Screen sharing

The project is intentionally limited in scope.

Do not expand the product beyond the defined MVP unless explicitly requested by the project owner.

---

# Repository Structure

This is a monorepo.

```text
/
├── frontend/              # React web application
├── backend/               # Spring Boot API
├── infrastructure/        # Docker, Nginx, LiveKit and infrastructure configuration
├── docs/                  # Project documentation and architecture decisions
├── AGENTS.md              # AI development instructions
└── README.md              # Project overview
```

Each application must remain independently buildable.

---

# Product Scope

## Included in MVP

### Authentication

* User registration
* User login
* JWT authentication (single long-lived access token, no refresh token — see docs/DECISIONS.md D2)
* Logout

### Servers

* Create server
* List servers
* Join server
* Leave server

### Channels

* Text channels
* Voice channels
* Channel listing
* Basic channel navigation

### Text Chat

* Send messages
* Receive messages in real time
* Persist messages
* Load message history

### Voice

* Join voice channel
* Leave voice channel
* Microphone mute/unmute

### Video

* Enable camera
* Disable camera
* Display participants' video

### Screen Sharing

* Start screen sharing
* Stop screen sharing
* Display shared screen

---

# Explicitly Out of Scope

Do NOT implement the following unless explicitly requested:

* Direct messages
* Group DMs
* Bots
* Threads
* Reactions
* GIF integration
* File uploads
* Advanced roles
* Advanced permissions
* Server discovery
* Complex moderation
* User custom statuses
* Rich presence
* Notifications
* Voice recording
* Stream recording
* Search
* Server boosting
* Payments
* Subscriptions
* Integrations
* Mobile applications
* Native desktop applications

Avoid implementing "nice to have" features that are not required by the MVP.

---

# Technology Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* TanStack Query
* Zustand

## Backend

* Java 21
* Spring Boot
* Spring Security
* Spring Web
* Spring WebSocket
* Spring Data JPA
* Hibernate
* Flyway
* Bean Validation

## Database

* PostgreSQL

PostgreSQL is the source of truth for persistent application data.

## Cache and Temporary State

* Redis (deferred for the initial MVP — see docs/DECISIONS.md D3; temporary state lives in backend memory until a real need for cross-instance coordination exists)

Redis must not replace PostgreSQL as the persistent source of truth.

## Real-Time Application Communication

* WebSocket
* JSON messages

WebSocket is used for application-level real-time events such as chat.

## Voice, Video and Screen Sharing

* WebRTC
* LiveKit
* Coturn

LiveKit is responsible for media routing/SFU functionality.

Do not implement an SFU from scratch.

Do not transport audio or video through WebSocket.

---

# Architecture

The backend is a modular monolith.

Do not introduce microservices for the MVP.

High-level architecture:

```text
                     Internet
                         |
                       HTTPS
                         |
                       Nginx
                         |
             +-----------+-----------+
             |                       |
          Frontend                Backend
           React                 Spring Boot
                                     |
                  +------------------+----------------+
                  |                  |                |
              PostgreSQL           Redis          LiveKit
                                                     |
                                                   WebRTC
                                                     |
                                      +--------------+-------------+
                                      |              |             |
                                    Audio          Video         Screen
```

## Frontend Responsibilities

The frontend is responsible for:

* UI
* Navigation
* Authentication state
* Server/channel interface
* Chat interface
* WebSocket client
* LiveKit/WebRTC client
* Local UI state

Do not put backend business rules into the frontend.

---

## Backend Responsibilities

The backend is responsible for:

* Authentication
* Authorization
* Users
* Servers
* Server membership
* Channels
* Messages
* Message persistence
* WebSocket application events
* LiveKit authentication/token generation
* Business rules

Do not expose JPA entities directly through REST APIs.

Use DTOs for API contracts.

---

## LiveKit Responsibilities

LiveKit is responsible for:

* Audio transport
* Video transport
* Screen sharing
* SFU functionality
* WebRTC media routing

The Spring Boot backend should control authorization and generate the required LiveKit access tokens.

---

# WebSocket Rules

WebSocket is used for application-level real-time communication.

Messages should use explicit event types.

Example:

```json
{
  "type": "MESSAGE_CREATE",
  "payload": {
    "channelId": "channel-id",
    "messageId": "message-id",
    "content": "Hello"
  }
}
```

Prefer explicit event names such as:

```text
MESSAGE_CREATE
MESSAGE_UPDATE
MESSAGE_DELETE

CHANNEL_CREATE
CHANNEL_UPDATE
CHANNEL_DELETE

SERVER_MEMBER_JOIN
SERVER_MEMBER_LEAVE
```

Do not send media through WebSocket.

---

# Backend Development Rules

Use a clear separation of responsibilities:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Database
```

DTOs must be used at API boundaries.

Business logic belongs in services, not controllers.

Controllers should remain thin.

Repositories should contain data-access logic only.

Avoid unnecessary abstractions.

Avoid premature generic frameworks.

---

# Frontend Development Rules

Prefer feature-oriented organization.

Example:

```text
src/
├── features/
│   ├── auth/
│   ├── servers/
│   ├── channels/
│   ├── chat/
│   └── calls/
│
├── components/
├── services/
├── hooks/
├── stores/
└── routes/
```

Avoid large components containing unrelated business logic.

Keep API communication outside presentation components.

Use global state only when necessary.

Prefer local component state when global state is not required.

---

# Database Rules

Use PostgreSQL.

Use Flyway for schema migrations.

Never modify production database structure manually when the change can be represented as a migration.

Migration files must be versioned.

Example:

```text
V1__create_users.sql
V2__create_servers.sql
V3__create_channels.sql
```

Do not introduce another database technology without explicit approval.

---

# Security Rules

Authentication must use secure password hashing.

Passwords must never be stored in plaintext.

JWT tokens must be validated on protected endpoints.

Never commit:

* passwords
* API keys
* JWT secrets
* private keys
* database credentials
* production environment variables

Use environment variables for secrets.

---

# Testing Rules

Backend tests should use:

* JUnit
* Mockito
* Spring Boot Test

Frontend tests should use:

* Vitest
* React Testing Library

Testcontainers and Playwright are deferred for the initial MVP (see
docs/DECISIONS.md D4) and may be introduced later if more confidence is
needed.

Every significant backend business feature should have automated tests.

Do not remove existing tests simply to make a build pass.

---

# Git Rules

Use Conventional Commits.

Examples:

```text
feat: add server creation
feat: add websocket chat
feat: add voice channel
feat: add screen sharing

fix: prevent duplicate messages

refactor: simplify channel service

test: add message service tests

docs: update architecture documentation
```

Keep commits focused.

Avoid mixing unrelated changes in the same commit.

---

# Development Workflow

Before implementing a feature:

1. Read `AGENTS.md`.
2. Read the relevant documentation under `/docs`.
3. Inspect the existing implementation.
4. Identify existing patterns.
5. Implement the smallest solution that satisfies the requirement.
6. Run relevant tests.
7. Fix failures.
8. Update documentation if the implementation changes an architectural decision.
9. Update the roadmap when a planned feature is completed.

Do not rewrite working code unnecessarily.

Do not introduce new dependencies without a clear reason.

---

# Architectural Changes

Do not make significant architectural changes silently.

Examples of significant changes:

* Introducing a new framework
* Replacing PostgreSQL
* Replacing Spring Boot
* Replacing React
* Introducing microservices
* Replacing LiveKit
* Changing the WebSocket protocol
* Changing authentication architecture
* Adding a new infrastructure service

If a significant architectural change is required, explain:

1. Why the current architecture is insufficient.
2. What the proposed change is.
3. What alternatives were considered.
4. What additional complexity it introduces.

The project owner must approve significant architectural changes.

---

# Scope Control

The MVP should remain small.

When a requested feature can be implemented in multiple ways, prefer the solution with:

1. Less complexity
2. Fewer dependencies
3. Easier maintenance
4. Clearer code
5. Lower infrastructure requirements

Do not optimize for hypothetical scale.

Build for the MVP first.

---

# Documentation

Important architectural decisions must be documented under `/docs`.

Documentation should describe the actual system.

Do not create speculative documentation for functionality that has not been implemented or decided.

When an architectural decision changes, update the corresponding documentation.

---

# AI Coding Behavior

The AI is an implementation assistant, not the project architect.

The AI should:

* Follow this document.
* Respect the existing architecture.
* Reuse existing patterns.
* Avoid unnecessary changes.
* Explain significant trade-offs.
* Keep changes focused.
* Ask before making significant architectural changes.

The AI should not:

* Expand the MVP scope
* Replace technologies without approval
* Introduce microservices
* Implement unnecessary abstractions
* Rewrite unrelated code
* Add dependencies without justification
* Assume requirements that were not specified

When requirements are ambiguous and the ambiguity could affect architecture or data design, ask for clarification before implementing.

---

# Definition of Done

A feature is considered complete when:

* The feature is implemented.
* Existing functionality still works.
* Relevant automated tests pass.
* No obvious security issue was introduced.
* The implementation follows the documented architecture.
* Documentation is updated when necessary.
* The roadmap is updated when appropriate.

The goal is not merely to produce code that compiles.

The goal is to maintain a coherent, understandable and deployable system.
