# TECH_STACK.md

# Technology Stack

## 1. Overview

This document defines the technologies, frameworks, libraries and infrastructure selected for the Discord MVP.

The stack is intentionally conservative and optimized for:

* Fast development
* Developer familiarity
* Maintainability
* Low infrastructure complexity
* Real-time communication
* Easy local development
* Simple deployment

Technologies must not be replaced or added without a clear technical reason.

---

# 2. Stack Summary

| Area                  | Technology                       |
| --------------------- | -------------------------------- |
| Repository            | Git + Monorepo                   |
| Frontend              | React                            |
| Frontend Language     | TypeScript                       |
| Frontend Build Tool   | Vite                             |
| Frontend Styling      | Tailwind CSS                     |
| Frontend Routing      | React Router                     |
| Frontend Server State | TanStack Query                   |
| Frontend Local State  | Zustand                          |
| Backend               | Spring Boot                      |
| Backend Language      | Java 21                          |
| API                   | REST                             |
| Application Realtime  | WebSocket                        |
| Authentication        | Spring Security + JWT            |
| ORM                   | Spring Data JPA + Hibernate      |
| Database              | PostgreSQL                       |
| Database Migration    | Flyway                           |
| Temporary State       | Redis                            |
| Media                 | WebRTC                           |
| Media Server / SFU    | LiveKit                          |
| TURN                  | Coturn                           |
| Reverse Proxy         | Nginx                            |
| Containers            | Docker                           |
| Local Orchestration   | Docker Compose                   |
| Backend Testing       | JUnit + Mockito + Testcontainers |
| Frontend Testing      | Vitest + React Testing Library   |
| E2E Testing           | Playwright                       |
| CI/CD                 | GitHub Actions                   |
| Initial Hosting       | Linux VM                         |

---

# 3. Repository

## Git

Git is used for source control.

The project uses a single repository.

```text
discord-mvp/
├── frontend/
├── backend/
├── infrastructure/
└── docs/
```

The repository must contain the complete application and infrastructure configuration required to develop and deploy the MVP.

---

# 4. Frontend

## React

React is the frontend framework.

Responsibilities:

* User interface
* Application navigation
* Server/channel interface
* Chat interface
* Voice/video interface
* Screen sharing interface
* WebSocket client
* LiveKit client

React should be used primarily for UI composition.

Business rules that require server authority belong in the backend.

---

## TypeScript

TypeScript is mandatory for frontend development.

Do not introduce JavaScript-only source files unless there is a specific technical reason.

Type safety should be maintained throughout the application.

Prefer explicit domain types for:

* Users
* Servers
* Channels
* Messages
* WebSocket events
* Media sessions

---

## Vite

Vite is the frontend build tool.

The frontend should remain a client-side application.

Server-side rendering is not required for the MVP.

Do not introduce Next.js unless the product requirements change and SSR/SEO becomes necessary.

---

## Tailwind CSS

Tailwind CSS is used for styling.

Prefer utility classes and reusable UI components.

Avoid introducing another CSS framework.

Global CSS should be kept minimal.

---

## React Router

React Router is used for client-side navigation.

Expected routes may include:

```text
/login
/register
/app
/app/servers/:serverId
/app/servers/:serverId/channels/:channelId
```

The exact route structure may evolve.

---

## TanStack Query

TanStack Query manages server state and API requests.

Use it for:

* REST API queries
* REST API mutations
* Request caching
* Loading states
* Error states
* Query invalidation

Do not use Zustand as a replacement for server-state management.

---

## Zustand

Zustand is used for lightweight client-side state.

Suitable examples:

* Authentication/session UI state
* Selected server
* Selected channel
* UI preferences
* Local communication state

Avoid putting all application data into a global Zustand store.

Prefer TanStack Query for server-owned data.

---

# 5. Backend

## Java

The backend uses:

```text
Java 21
```

Java 21 is the baseline runtime and language version.

Do not downgrade the Java version without explicit approval.

---

## Spring Boot

Spring Boot is the backend framework.

Responsibilities include:

* REST API
* Authentication
* Authorization
* Business logic
* Database access
* WebSocket handling
* LiveKit integration

The backend is a modular monolith.

---

## Spring Web

Spring Web is used for REST APIs.

API endpoints should follow resource-oriented conventions.

Example:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/servers
POST   /api/v1/servers

GET    /api/v1/servers/{serverId}/channels
POST   /api/v1/servers/{serverId}/channels

GET    /api/v1/channels/{channelId}/messages
```

The exact API contract will be documented separately.

---

# 6. Spring Security

Spring Security is responsible for:

* Authentication
* Authorization
* Password security
* JWT validation
* Protected API endpoints

The backend must never trust authorization decisions made exclusively by the frontend.

---

# 7. JWT

JWT is used for authenticated API access.

Conceptually:

```text
Login
  ↓
Spring Security
  ↓
JWT
  ↓
Authenticated API requests
```

The initial MVP uses a single long-lived access token with no refresh
token (see docs/DECISIONS.md D2). Logout discards the token client-side;
there is no server-side revocation list.

Secrets must be provided through environment variables.

---

# 8. Password Storage

User passwords must never be stored in plaintext.

Use a strong password hashing mechanism supported by Spring Security.

The password hashing implementation should use an adaptive algorithm appropriate for password storage.

---

# 9. REST API

REST is used for request/response operations.

Use REST for operations such as:

* Authentication
* Server creation
* Server listing
* Channel creation
* Message history
* User data

Do not use WebSocket for operations that do not require real-time delivery.

---

# 10. WebSocket

WebSocket is used for application-level real-time events.

Examples:

```text
MESSAGE_CREATE
MESSAGE_UPDATE
MESSAGE_DELETE

CHANNEL_CREATE
CHANNEL_UPDATE
CHANNEL_DELETE

SERVER_MEMBER_JOIN
SERVER_MEMBER_LEAVE

SERVER_DELETE
SERVER_OWNER_CHANGE
```

`SERVER_DELETE` and `SERVER_OWNER_CHANGE` were added to this vocabulary
during Phase 1 planning — see `docs/DECISIONS.md` D15.

WebSocket messages use JSON.

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

The WebSocket protocol will be documented separately in:

```text
docs/WEBSOCKET.md
```

---

# 11. WebSocket vs WebRTC

The technologies have different responsibilities.

## WebSocket

Used for:

* Chat events
* Application events
* State changes
* Signaling-related application events when required

## WebRTC / LiveKit

Used for:

* Microphone audio
* Camera video
* Screen sharing

The application must not send continuous audio/video frames through WebSocket.

---

# 12. Spring Data JPA

Spring Data JPA is used for database access.

JPA entities represent persistent domain data.

Repositories are responsible for persistence operations.

Business logic must not be implemented inside repositories.

---

# 13. Hibernate

Hibernate is the JPA implementation used by the backend.

Hibernate should be used primarily for:

* Entity persistence
* Relationships
* Basic queries
* Transactional persistence

Avoid relying on complex ORM behavior when a simple explicit query is clearer.

---

# 14. DTOs

DTOs are mandatory at external API boundaries.

Do not expose JPA entities directly through REST APIs.

Example:

```text
Entity
    ↓
Service
    ↓
Response DTO
    ↓
REST API
```

Request DTOs should also be used for API input.

---

# 15. Validation

Use Bean Validation for API input validation.

Examples:

* Required fields
* String length
* Email format
* Password requirements
* Channel name constraints
* Server name constraints

Validation errors should return consistent API responses.

---

# 16. PostgreSQL

PostgreSQL is the primary relational database.

It is the source of truth for persistent application data.

Expected data includes:

```text
Users
Servers
Server Members
Channels
Messages
```

The exact schema is defined separately in:

```text
docs/DATABASE.md
```

---

# 17. Flyway

Flyway is mandatory for database schema migrations.

Example:

```text
V1__create_users.sql
V2__create_servers.sql
V3__create_server_members.sql
V4__create_channels.sql
V5__create_messages.sql
```

Every schema modification must be represented by a migration.

Do not modify production schema manually.

---

# 18. Redis

Redis is deferred for the initial MVP (see docs/DECISIONS.md D3). The
deployment target is a single backend instance on a single VM, so there is
no cross-instance coordination problem to solve yet. Any state that would
use Redis lives in backend memory instead.

Potential future uses, once a real need exists:

* Rate limiting
* Presence
* Temporary session state
* Pub/Sub
* WebSocket coordination
* Caching

Redis is not the source of truth for persistent application data.

Do not introduce Redis-backed persistence where PostgreSQL is more appropriate.

---

# 19. WebRTC

WebRTC provides real-time media communication.

The MVP uses WebRTC for:

* Audio
* Video
* Screen sharing

The application should use WebRTC through LiveKit rather than implementing the media server itself.

---

# 20. LiveKit

LiveKit is the selected media infrastructure.

LiveKit provides:

* SFU
* Media routing
* Audio tracks
* Video tracks
* Screen-sharing tracks
* Participant management
* WebRTC infrastructure

The backend is responsible for application authorization and generating LiveKit access tokens.

The frontend uses the LiveKit client SDK to join media sessions.

---

# 21. Media Model

Voice, video and screen sharing belong to the same communication session.

Conceptually:

```text
Communication Session
        |
        +---- Microphone Track
        |
        +---- Camera Track
        |
        +---- Screen Track
```

The user does not create separate communication sessions for:

* Voice
* Video
* Screen sharing

---

# 22. Coturn

Coturn provides TURN functionality.

TURN is required when direct network connectivity cannot be established.

Coturn is infrastructure rather than application business logic.

The backend should not implement TURN functionality.

---

# 23. Nginx

Nginx is the reverse proxy and external entry point.

Responsibilities:

* HTTPS/TLS termination
* Frontend routing
* REST API proxying
* WebSocket proxying
* HTTP security configuration

Conceptual routing:

```text
/
    → Frontend

/api/
    → Spring Boot

/ws/
    → Spring WebSocket
```

LiveKit networking follows its own required configuration.

---

# 24. Docker

Docker is used for consistent development and deployment environments.

Application services should be containerized where practical.

Expected services:

```text
frontend
backend
postgres
redis
livekit
coturn
nginx
```

---

# 25. Docker Compose

Docker Compose is used for local development and the initial deployment.

The goal is to make the complete development environment startable with a small number of commands.

Example:

```bash
docker compose up -d
```

The exact service configuration will be defined under:

```text
infrastructure/
```

---

# 26. Configuration

Configuration must be environment-based.

Examples:

```text
DATABASE_URL
DATABASE_USERNAME
DATABASE_PASSWORD

JWT_SECRET

REDIS_URL

LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET

TURN_SERVER
TURN_USERNAME
TURN_PASSWORD
```

Actual production values must never be committed.

Provide safe example configuration through files such as:

```text
.env.example
```

---

# 27. Testing

## Backend

Use:

* JUnit 5
* Mockito
* Spring Boot Test

Test level for the initial MVP:

```text
Unit Tests
```

Testcontainers is deferred for the initial MVP (see docs/DECISIONS.md D4).
Prefer mocks or H2 in-memory when a repository-level test is actually
needed. Reintroduce Testcontainers later if integration-level confidence
becomes necessary.

---

## Frontend

Use:

* Vitest
* React Testing Library

Test:

* Components
* Hooks
* Client-side behavior
* Important UI interactions

---

## End-to-End

Playwright E2E is deferred for the initial MVP (see docs/DECISIONS.md D4).

Candidate flows to cover once introduced:

```text
Register
  ↓
Login
  ↓
Create server
  ↓
Create channel
  ↓
Send message
```

Later, real-time communication flows should also be covered where practical.

---

# 28. CI/CD

GitHub Actions is used for CI/CD.

A typical pipeline:

```text
Push / Pull Request
        |
        +---- Frontend
        |       ├── Install
        |       ├── Lint
        |       ├── Test
        |       └── Build
        |
        +---- Backend
        |       ├── Build
        |       ├── Test
        |       └── Package
        |
        └---- Infrastructure
                └── Validate configuration
```

Deployment automation can be introduced after the application is stable.

---

# 29. Initial Hosting

The initial production environment is a Linux VM.

The first deployment should prioritize simplicity.

Expected environment:

```text
Linux
Docker
Docker Compose
Nginx
PostgreSQL
Redis
LiveKit
Coturn
Spring Boot
Frontend
```

The exact provider is not part of the application architecture.

---

# 30. Dependency Management

Dependencies must be added only when they solve a real problem.

Before adding a dependency:

1. Check whether the existing stack already provides the required functionality.
2. Check whether the functionality can be implemented simply without another dependency.
3. Consider maintenance and security implications.
4. Add the dependency only if the benefit justifies the additional complexity.

Do not add libraries merely because they are popular.

---

# 31. Technology Restrictions

The following technologies are explicitly not part of the MVP unless approved:

```text
Kafka
RabbitMQ
Kubernetes
MongoDB
Cassandra
Elasticsearch
GraphQL
Next.js
Microservices
Event Sourcing
CQRS
Custom SFU
Custom WebRTC server
```

This does not mean these technologies are inherently inappropriate.

They are simply unnecessary for the current MVP.

---

# 32. Version Policy

Prefer stable versions compatible with the selected stack.

Major version upgrades should not be performed automatically during feature development.

Dependency upgrades should be treated as deliberate maintenance work.

When upgrading a major dependency, verify:

* Compatibility
* Tests
* Build
* Runtime behavior
* Documentation

---

# 33. Architecture Consistency

The following boundaries must remain clear:

```text
React
    ↓
User Interface

Spring Boot
    ↓
Application Logic

PostgreSQL
    ↓
Persistent Data

Redis
    ↓
Temporary State / Coordination

WebSocket
    ↓
Application Real-Time Events

WebRTC
    ↓
Media Transport

LiveKit
    ↓
Media Infrastructure

Coturn
    ↓
TURN Connectivity

Nginx
    ↓
External Network Entry Point
```

A component should not take responsibility for another component's primary role.

---

# 34. Technology Decision Rule

When choosing between two technologies or libraries, prefer the option that:

1. Fits the existing architecture.
2. Has fewer operational requirements.
3. Has fewer dependencies.
4. Is easier to maintain.
5. Is familiar to the development team.
6. Solves the current problem rather than a hypothetical future problem.

The goal is not to build the most technologically sophisticated system.

The goal is to build a reliable MVP with a clear path for evolution.

---

# 35. Source of Truth

Technology choices are defined in this document.

Product requirements are defined in:

```text
docs/PRODUCT.md
```

System architecture is defined in:

```text
docs/ARCHITECTURE.md
```

AI development rules are defined in:

```text
AGENTS.md
```

Architectural decisions and exceptions are documented in:

```text
docs/DECISIONS.md
```

If implementation requirements conflict with this document, do not silently change the technology stack.

Discuss and document the change first.
