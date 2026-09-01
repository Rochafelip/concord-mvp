# ARCHITECTURE.md

# System Architecture

## 1. Overview

This project is a Discord-inspired real-time communication platform MVP.

The system is designed around four core capabilities:

* Real-time text communication
* Voice communication
* Video communication
* Screen sharing

The architecture uses a **modular monolith** for the application backend and a dedicated real-time media server for audio/video communication.

The project is maintained as a **monorepo**.

---

# 2. Architectural Goals

The architecture must prioritize:

1. Simplicity
2. Maintainability
3. Clear separation of responsibilities
4. Real-time communication reliability
5. Easy local development
6. Simple deployment
7. Low infrastructure complexity
8. Ability to evolve after the MVP

The architecture must avoid unnecessary complexity.

---

# 3. High-Level Architecture

```text
                              INTERNET
                                  |
                         HTTPS / WebSocket
                                  |
                              +---v---+
                              | Nginx |
                              +---+---+
                                  |
                    +-------------+-------------+
                    |                           |
              +-----v------+              +-----v------+
              |  Frontend  |              |  Backend   |
              |   React    |              | Spring Boot|
              +------------+              +-----+------+
                                                |
                              +-----------------+-----------------+
                              |                 |                 |
                        +-----v-----+     +-----v-----+     +-----v-----+
                        | PostgreSQL|     |   Redis   |     |  LiveKit  |
                        +-----------+     +-----------+     +-----+-----+
                                                                    |
                                                                  WebRTC
                                                                    |
                                                     +--------------+--------------+
                                                     |              |              |
                                                   Audio          Video         Screen
```

---

# 4. Repository Architecture

The project uses a monorepo.

```text
/
├── frontend/
├── backend/
├── infrastructure/
├── docs/
├── AGENTS.md
└── README.md
```

## Frontend

Contains the web application.

```text
frontend/
```

Technology:

* React
* TypeScript
* Vite
* Tailwind CSS

---

## Backend

Contains the main application server.

```text
backend/
```

Technology:

* Java 21
* Spring Boot

The backend is a modular monolith.

---

## Infrastructure

Contains infrastructure configuration.

```text
infrastructure/
```

Expected responsibilities:

* Docker
* Docker Compose
* Nginx
* LiveKit
* Coturn
* Environment configuration templates

Infrastructure configuration must not contain application business logic.

---

## Documentation

```text
docs/
```

Contains:

* Product definition
* Architecture
* Technology decisions
* Database design
* API contracts
* WebSocket protocol
* WebRTC/media architecture
* Development documentation
* Roadmap
* Architecture decisions

---

# 5. System Components

The system consists of the following major components:

```text
Frontend
Backend
PostgreSQL
Redis
WebSocket
LiveKit
Coturn
Nginx
```

Each component has a defined responsibility.

---

# 6. Frontend

The frontend is a single-page web application.

## Responsibilities

The frontend is responsible for:

* Rendering the user interface
* User interaction
* Client-side navigation
* Authentication state
* Server navigation
* Channel navigation
* Text chat interface
* WebSocket client
* Voice/video interface
* LiveKit client
* Local media permissions
* Local UI state

The frontend must not contain authoritative business rules.

---

# 7. Frontend Architecture

The frontend should use a feature-oriented structure.

Example:

```text
frontend/src/

├── app/
│
├── features/
│   ├── auth/
│   ├── servers/
│   ├── channels/
│   ├── chat/
│   └── calls/
│
├── components/
├── hooks/
├── services/
├── stores/
├── routes/
├── types/
└── utils/
```

The exact structure may evolve as implementation progresses.

The architectural principle is more important than the exact directory names:

> Features should be grouped by domain rather than by technical type alone.

---

# 8. Backend

The backend is a modular monolith.

All core application business logic resides in a single Spring Boot application during the MVP.

The backend is responsible for:

* Authentication
* Authorization
* User management
* Server management
* Server membership
* Channel management
* Message persistence
* Message retrieval
* WebSocket application events
* LiveKit access control
* LiveKit token generation

---

# 9. Backend Module Boundaries

The backend should be organized by domain.

Expected modules:

```text
backend/src/main/java/.../

├── auth/
├── users/
├── servers/
├── channels/
├── messages/
├── realtime/
└── media/
```

These modules represent logical boundaries inside the monolith.

They are not independent services.

---

# 10. Backend Layering

Each domain should follow a clear dependency direction.

```text
Controller
    |
    v
Service
    |
    v
Repository
    |
    v
Database
```

## Controller

Responsible for:

* HTTP request handling
* Input validation
* Authentication context
* Mapping requests to services
* Mapping service results to responses

Controllers should remain thin.

---

## Service

Responsible for:

* Business rules
* Authorization decisions
* Domain operations
* Transaction boundaries
* Coordination between repositories and other services

---

## Repository

Responsible for:

* Database access
* Queries
* Persistence operations

Repositories should not contain business logic.

---

## DTO

DTOs define external API contracts.

JPA entities must not be exposed directly through REST endpoints.

---

# 11. Authentication Architecture

Authentication is handled by Spring Security.

The initial authentication model is:

```text
Client
   |
   | Login
   v
Spring Boot
   |
   | validate credentials
   v
PostgreSQL
   |
   | authenticated
   v
JWT
```

Protected requests:

```text
Client
   |
   | Bearer Token
   v
Spring Security
   |
   | validate
   v
Controller
```

The exact token lifecycle is documented separately in the authentication/API documentation.

---

# 12. PostgreSQL

PostgreSQL is the persistent source of truth.

It stores application data such as:

```text
Users
Servers
Server Members
Channels
Messages
```

Potential additional entities may be introduced when required.

The database must not be used as a real-time message broker.

---

# 13. Database Migrations

Database schema changes must use Flyway.

Example:

```text
V1__create_users.sql
V2__create_servers.sql
V3__create_server_members.sql
V4__create_channels.sql
V5__create_messages.sql
```

Schema changes must be versioned.

Manual production schema modifications should be avoided.

---

# 14. Redis

Redis is not the primary database.

It is used for temporary or coordination-related state.

Potential uses include:

* Session-related temporary state
* Rate limiting
* Presence
* WebSocket coordination
* Pub/Sub
* Caching

Redis usage should only be introduced where it provides a clear benefit.

The application must remain conceptually correct if PostgreSQL is the persistent source of truth.

---

# 15. Real-Time Architecture

The system uses two separate real-time technologies.

```text
Application Events
        |
    WebSocket
        |
    Spring Boot
```

and:

```text
Audio / Video / Screen
        |
      WebRTC
        |
     LiveKit
```

These two communication systems must remain conceptually separate.

---

# 16. WebSocket

WebSocket is responsible for application-level real-time events.

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
```

The exact protocol is defined in:

```text
docs/WEBSOCKET.md
```

WebSocket must not be used as the transport layer for audio or video.

---

# 17. WebSocket Message Model

Messages use JSON.

Example:

```json
{
  "type": "MESSAGE_CREATE",
  "payload": {
    "channelId": "channel-id",
    "messageId": "message-id",
    "content": "Hello world"
  }
}
```

Events should use explicit, stable event names.

Event payloads should contain only the information required by the client.

---

# 18. Text Message Flow

The expected flow is:

```text
User
 |
 | send message
 v
Frontend
 |
 | WebSocket
 v
Spring Boot
 |
 +--> validate authentication
 |
 +--> validate channel access
 |
 +--> persist message
 |
 +--> publish MESSAGE_CREATE
 |
 +--> connected clients
```

Persistence should happen before broadcasting the message as a successful application event.

The database remains the source of truth for message history.

---

# 19. Voice Architecture

Voice communication uses WebRTC through LiveKit.

The application backend does not transport voice media.

Expected flow:

```text
User
 |
 | request to join voice channel
 v
Spring Boot
 |
 | validate membership/access
 |
 | generate LiveKit access token
 v
Frontend
 |
 | connect to LiveKit
 v
LiveKit
 |
 +------ Participant A
 +------ Participant B
 +------ Participant C
```

---

# 20. Video Architecture

Video uses the same media session as voice.

```text
Voice/Video Session
        |
        +---- Audio Track
        |
        +---- Video Track
```

The frontend publishes the camera track to LiveKit.

LiveKit distributes the media to other participants.

The backend does not proxy camera video.

---

# 21. Screen Sharing Architecture

Screen sharing uses the same communication session.

```text
User
 |
 | capture screen
 v
Browser
 |
 | WebRTC track
 v
LiveKit
 |
 +---- Participant A
 +---- Participant B
 +---- Participant C
```

The browser is responsible for requesting screen capture permission.

The backend is responsible for authorization/session access.

LiveKit is responsible for media distribution.

---

# 22. Media Session Model

Voice, video and screen sharing are treated as capabilities of the same communication session.

Conceptually:

```text
                  Voice Channel
                       |
                Communication Session
                       |
             +---------+---------+
             |         |         |
           Audio     Camera    Screen
             |         |         |
            🎤        📹        🖥️
```

A user should not create separate sessions for:

* Voice
* Video
* Screen sharing

Video and screen sharing are additional media tracks within the communication session.

---

# 23. Coturn

Coturn provides TURN functionality for WebRTC.

It is used when direct peer connectivity is not possible.

Conceptually:

```text
Client A
   |
   | direct connection
   |       OR
   | TURN
   v
Client / LiveKit infrastructure
```

The exact networking configuration is defined in infrastructure documentation.

---

# 24. Nginx

Nginx is the external entry point for the application.

Responsibilities:

* TLS termination
* HTTP routing
* WebSocket upgrade/proxying
* Frontend serving or routing
* Backend API routing

Conceptual routing:

```text
https://domain/
        |
        v
      Nginx
        |
        +---- /        -> Frontend
        |
        +---- /api     -> Spring Boot
        |
        +---- /ws      -> Spring WebSocket
```

LiveKit media traffic should follow its own required networking configuration.

---

# 25. Request Flow

## REST

```text
Browser
   |
 HTTPS
   v
 Nginx
   |
   v
Spring Boot
   |
   v
Service
   |
   v
Repository
   |
   v
PostgreSQL
```

## WebSocket

```text
Browser
   |
 WSS
   v
Nginx
   |
   v
Spring WebSocket
   |
   v
Application Event Handling
```

## Media

```text
Browser
   |
 WebRTC
   |
   v
LiveKit
   |
   +---- Audio
   +---- Video
   +---- Screen
```

---

# 26. Authorization Model

The backend is authoritative for access control.

At minimum:

```text
User
 |
 +---- Server Membership
          |
          +---- Channel Access
```

The frontend must not be trusted to enforce authorization.

For example:

```text
Frontend says:
"I am a member of server X"

Backend must verify it.
```

---

# 27. Server and Channel Model

The conceptual hierarchy is:

```text
User
 |
 +---- Server
         |
         +---- Text Channel
         |
         +---- Voice Channel
```

A server contains channels.

A user must belong to a server before accessing its channels.

---

# 28. Media Authorization

LiveKit access must be associated with application-level authorization.

Expected flow:

```text
User
 |
 | authenticated request
 v
Spring Boot
 |
 | verify:
 | - user identity
 | - server membership
 | - channel access
 |
 | generate authorized LiveKit token
 v
Client
 |
 | connect
 v
LiveKit
```

The frontend must not be able to generate arbitrary LiveKit credentials.

---

# 29. Error Boundaries

Errors should be handled at the appropriate layer.

```text
Frontend
   |
   | user-facing errors
   v
Backend
   |
   | business/application errors
   v
Database / Infrastructure
   |
   | infrastructure failures
```

The backend should return consistent API error responses.

WebSocket errors should use explicit error events where appropriate.

Media connection failures should be surfaced clearly in the UI.

---

# 30. Scalability Strategy

The MVP is designed for a small number of users.

Initial deployment:

```text
Single VM
```

The architecture should not introduce distributed infrastructure prematurely.

Future scaling may include:

```text
                 Load Balancer
                      |
            +---------+---------+
            |                   |
       Backend #1          Backend #2
            |                   |
            +---------+---------+
                      |
                    Redis
                      |
                  PostgreSQL
```

LiveKit infrastructure can be scaled independently if required.

This is a future concern and is not part of the initial MVP.

---

# 31. Deployment Architecture

Initial production architecture:

```text
                         Internet
                             |
                           HTTPS
                             |
                           Nginx
                             |
              +--------------+--------------+
              |                             |
          Frontend                       Backend
                                           |
                         +-----------------+----------------+
                         |                 |                |
                     PostgreSQL          Redis          LiveKit
                                                            |
                                                          WebRTC
                                                            |
                                                          Coturn
```

All initial services may run on a single VM using Docker Compose.

The architecture must keep service boundaries clear enough to allow later separation.

---

# 32. Observability

The MVP should provide basic observability.

At minimum:

* Application logs
* HTTP error logs
* WebSocket connection errors
* Media connection errors
* Database errors

Detailed distributed tracing is not required for the MVP.

Monitoring should be introduced progressively.

---

# 33. Security Principles

Security-sensitive operations must always be handled server-side.

Never trust:

* Client-provided user IDs
* Client-provided server membership
* Client-provided permissions
* Client-provided channel ownership
* Client-generated media credentials

Secrets must be provided through environment variables.

Never commit production secrets to the repository.

---

# 34. Architectural Constraints

The following constraints apply to the MVP:

### Backend

Must remain a modular monolith.

### Database

PostgreSQL is the persistent source of truth.

### Application Real-Time

WebSocket is used for application events.

### Media

WebRTC is used for media.

### SFU

LiveKit provides SFU functionality.

### TURN

Coturn provides TURN infrastructure.

### Deployment

Docker-based deployment is preferred.

### Repository

The project remains a monorepo.

---

# 35. What This Architecture Does Not Do

The architecture intentionally does not include:

* Microservices
* Kubernetes
* Kafka
* Event sourcing
* CQRS
* Multiple databases
* Custom SFU
* Custom WebRTC server
* Global distributed infrastructure
* Multi-region deployment

These technologies may be evaluated in the future if actual requirements justify them.

They should not be introduced solely for hypothetical scalability.

---

# 36. Architecture Evolution

Architecture decisions should be based on actual requirements and observed limitations.

Before introducing a significant new infrastructure component, answer:

1. What problem does it solve?
2. Does the current architecture actually have this problem?
3. Can the problem be solved more simply?
4. What operational complexity does it introduce?
5. Does it belong in the MVP?

Significant architectural changes must be documented in:

```text
docs/DECISIONS.md
```

---

# 37. Source of Truth

The following documents have different responsibilities:

```text
AGENTS.md
    ↓
Development rules and AI behavior

PRODUCT.md
    ↓
What the product must do

ARCHITECTURE.md
    ↓
How the system is organized

TECH_STACK.md
    ↓
Which technologies are used

DECISIONS.md
    ↓
Why important architectural decisions were made

ROADMAP.md
    ↓
What is planned and what has been completed
```

If these documents conflict, the project owner must resolve the conflict before implementation continues.

---

# 38. Architectural Principle

The central architectural principle of this project is:

> Keep application logic simple, keep media infrastructure specialized, and keep responsibilities clearly separated.

In practical terms:

```text
Spring Boot
    = application logic

PostgreSQL
    = persistent data

Redis
    = temporary state / coordination

WebSocket
    = application real-time events

LiveKit
    = real-time media

WebRTC
    = media transport

Coturn
    = TURN connectivity

React
    = user interface
```

The system should remain understandable to a single developer throughout the MVP.
