# PRODUCT.md

# Product Definition

## 1. Product Overview

This project is a Discord-inspired real-time communication platform.

The objective is to build a focused MVP that provides the essential experience of:

* Creating and joining servers
* Organizing communication into channels
* Sending messages in real time
* Joining voice channels
* Using microphone and camera
* Sharing the screen with other participants

The MVP is not intended to reproduce all Discord features.

The primary goal is to validate the core real-time communication experience with a simple, maintainable and deployable product.

---

# 2. Product Goals

The MVP should allow a user to:

1. Create an account.
2. Log into the application.
3. Create a server.
4. Join an existing server.
5. See the channels available in a server.
6. Create text and voice channels.
7. Communicate through real-time text chat.
8. Join a voice channel.
9. Talk using a microphone.
10. Enable a camera.
11. See other participants' cameras.
12. Share their screen.
13. See another participant's shared screen.
14. Leave the communication session.

The complete experience should work in a real environment, not only in development or mock data.

---

# 3. Target User

The initial target user is a person who wants a simple platform for real-time communication with a small group.

Typical use cases include:

* Friends communicating while playing games
* Small communities
* Study groups
* Private groups
* Small development teams
* Remote collaboration

The MVP does not target large enterprise organizations or massive public communities.

---

# 4. Core User Experience

The primary user flow is:

```text
Register
   ↓
Login
   ↓
Application
   ↓
Create or join a server
   ↓
Select a channel
   ↓
Text chat
   ↓
Join voice channel
   ↓
Enable microphone
   ↓
Enable camera
   ↓
Share screen
   ↓
Leave channel
```

The user should be able to understand the interface without requiring documentation.

---

# 5. Authentication

## 5.1 Registration

A user must be able to create an account.

Minimum information:

* Username
* Email
* Password

The system must prevent duplicate accounts using the same email.

## 5.2 Login

A registered user must be able to authenticate using:

* Email
* Password

## 5.3 Session

Authenticated users should remain authenticated across normal application navigation.

The application must provide a logout mechanism.

## 5.4 Authentication Errors

The interface must provide clear feedback for:

* Invalid credentials
* Duplicate email
* Invalid registration data
* Expired session
* Unauthorized access

---

# 6. User Profile

The MVP requires a minimal user identity.

Minimum information:

* User ID
* Username
* Email
* Avatar or avatar placeholder

Advanced profile customization is not part of the MVP.

---

# 7. Servers

A server is the primary organizational unit of the application.

## 7.1 Create Server

An authenticated user can create a server.

Minimum information:

* Server name

The user who creates the server becomes its initial owner.

## 7.2 Server List

The user must be able to see the servers they belong to.

## 7.3 Join Server

A user must be able to join a server through an invitation mechanism.

The exact invitation implementation may be defined during development.

## 7.4 Leave Server

A user must be able to leave a server.

The server owner must not be able to leave without transferring ownership or deleting the server.

The exact ownership behavior should be kept simple for the MVP.

## 7.5 Server Selection

Selecting a server should display its available channels.

---

# 8. Channels

Servers contain channels.

The MVP supports two channel types:

```text
Text Channel
Voice Channel
```

## 8.1 Text Channel

A text channel is used for real-time messaging.

Example:

```text
# general
# gaming
# development
```

## 8.2 Voice Channel

A voice channel is used for real-time audio communication.

Example:

```text
🔊 General
🔊 Gaming
🔊 Meeting
```

## 8.3 Channel Creation

Authorized server members should be able to create channels.

Minimum information:

* Channel name
* Channel type

Advanced permissions are outside the MVP.

---

# 9. Text Chat

Text chat is a core MVP feature.

## 9.1 Send Message

A user can send a text message to the currently selected text channel.

Minimum message information:

* Message ID
* Author
* Channel
* Content
* Creation timestamp

## 9.2 Real-Time Delivery

Messages must appear for connected users without requiring a page refresh.

Example:

```text
User A
   |
   | sends message
   ↓
Server
   |
   +----> User B
   +----> User C
```

## 9.3 Message History

Messages must be persisted.

When entering a text channel, the application should load previously stored messages.

## 9.4 Message Ordering

Messages must appear in chronological order.

## 9.5 Empty Messages

The application must not allow empty messages to be sent.

## 9.6 Message Editing

Message editing is not required for the initial MVP.

## 9.7 Message Deletion

Message deletion is not required for the initial MVP.

---

# 10. Voice Communication

Voice communication is one of the primary MVP features.

## 10.1 Join Voice Channel

A user can join a voice channel.

The interface must clearly indicate that the user is connected.

## 10.2 Leave Voice Channel

A user can leave the voice channel.

## 10.3 Microphone

The user must be able to:

* Enable microphone
* Disable microphone

The current microphone state must be visible.

Example:

```text
🎤 Felipe
🔇 João
🎤 Maria
```

## 10.4 Multiple Participants

Multiple users must be able to communicate in the same voice channel.

The MVP should support at least a small group of simultaneous participants.

The exact scalability target will be defined separately from the functional MVP.

---

# 11. Video Communication

Video is an extension of voice communication.

## 11.1 Camera

A user can:

* Enable camera
* Disable camera

## 11.2 Video Participants

Users with an enabled camera should have their video displayed to other participants.

Example:

```text
┌─────────────┬─────────────┐
│   Felipe    │    João     │
│    📹       │     📹      │
│             │             │
├─────────────┼─────────────┤
│    Maria    │    Pedro    │
│    📹       │     🎤      │
└─────────────┴─────────────┘
```

Users without a camera enabled should still be represented in the call.

---

# 12. Screen Sharing

Screen sharing is a core MVP feature.

## 12.1 Start Sharing

A user can start sharing their screen while connected to a voice channel.

## 12.2 Stop Sharing

A user can stop sharing at any time.

## 12.3 Screen Viewer

Other participants must be able to view the shared screen.

The interface should clearly distinguish:

* Camera video
* Screen share

## 12.4 Screen Sharing and Camera

A user should be able to share their screen while their camera is enabled.

The exact layout behavior can be refined during implementation.

---

# 13. Voice / Video / Screen Session

Voice, video and screen sharing belong to the same communication session.

Conceptually:

```text
                    Communication Session
                             |
             +---------------+---------------+
             |               |               |
           Audio           Video          Screen
             |               |               |
           🎤                📹              🖥️
```

The user should not need to create separate sessions for voice, video or screen sharing.

---

# 14. Real-Time Requirements

The application has two different real-time communication categories.

## Application Events

Examples:

* New message
* Server changes
* Channel changes
* User joins/leaves a channel

These are application-level events.

## Media

Examples:

* Microphone audio
* Camera video
* Screen sharing

These are media streams.

The implementation must maintain a clear separation between application events and media transport.

---

# 15. Permissions

The MVP requires basic authorization.

At minimum:

### Unauthenticated user

Can:

* Register
* Login

Cannot:

* Access private application data
* Access servers
* Access channels
* Send messages
* Join voice channels

### Authenticated user

Can:

* Create servers
* Join servers
* Leave servers
* View available channels
* Send messages in accessible channels
* Join voice channels

### Server owner

Can additionally:

* Manage the server
* Create channels

Advanced permission systems are outside the MVP.

---

# 16. Error Handling

The product must handle common failure scenarios gracefully.

Examples:

* Network connection lost
* Authentication failure
* Server unavailable
* WebSocket disconnected
* Microphone permission denied
* Camera permission denied
* Screen sharing permission denied
* Voice connection failure

The user should receive a clear indication when an operation fails.

The application must not silently fail whenever the failure affects the user's ability to communicate.

---

# 17. Connection State

The application should distinguish between:

```text
Connected
Connecting
Disconnected
```

This applies particularly to:

* Application connection
* Chat connection
* Voice/video session

The MVP does not require a complex presence system.

---

# 18. Responsive Interface

The initial client is a web application.

The interface should work on:

* Desktop
* Tablet
* Mobile browser

Desktop is the primary target for the initial MVP.

The interface should prioritize communication usability over mobile-specific optimization.

---

# 19. MVP Non-Goals

The following features are explicitly excluded from the MVP.

## Social

* Friends system
* Direct messages
* Group DMs
* User discovery
* Custom status
* Rich presence

## Chat

* Threads
* Reactions
* GIFs
* Stickers
* Emoji system
* Message editing
* Message deletion
* Markdown editor
* Message search
* Pinned messages

## Media

* Voice recording
* Call recording
* Stream recording
* Video recording
* Streaming to external platforms
* Background effects
* Noise suppression controls beyond browser/platform capabilities

## Server Management

* Complex roles
* Fine-grained permissions
* Server discovery
* Server verification
* Server boosting
* Server subscriptions
* Moderation bots

## Integrations

* Bots
* Webhooks
* External integrations
* Third-party authentication

## Infrastructure

* Multi-region deployment
* Automatic global scaling
* Kubernetes
* Microservice architecture

These may be considered after the MVP is validated.

---

# 20. MVP Success Criteria

The MVP is considered functionally successful when a small group of users can complete the following scenario without manual intervention:

```text
User A
  ↓
Creates account
  ↓
Creates server
  ↓
Creates text channel
  ↓
Creates voice channel
  ↓
Shares invitation
  ↓

User B
  ↓
Creates account
  ↓
Joins server
  ↓

User A + User B
  ↓
Enter text channel
  ↓
Exchange messages in real time
  ↓
Enter voice channel
  ↓
Communicate using microphone
  ↓
Enable cameras
  ↓
See each other's video
  ↓
User A shares screen
  ↓
User B sees shared screen
  ↓
Both leave the session
```

This end-to-end scenario is the primary functional validation of the MVP.

---

# 21. Product Principles

## Real-Time First

Real-time communication is the central purpose of the product.

## Simple Over Complete

The MVP should provide a small number of features that work well instead of many incomplete features.

## Functional Over Cosmetic

Visual polish is important, but functionality and reliability have priority during MVP development.

## No Premature Features

Features outside the defined MVP should not be implemented unless explicitly approved.

## No Premature Scaling

The initial implementation should support a small number of users efficiently.

The architecture should avoid unnecessary complexity for hypothetical future scale.

## Clear Separation

The product must maintain a clear conceptual separation between:

* Application data
* Application real-time events
* Media communication
* Persistent storage

---

# 22. Future Possibilities

The following features may be considered after the MVP:

* Direct messages
* Friends
* Reactions
* Threads
* File sharing
* Advanced permissions
* Bots
* Notifications
* Mobile applications
* Native desktop applications
* Server discovery
* Moderation tools
* Recording
* Advanced voice features

These are not commitments and should not influence the MVP implementation unless explicitly approved.

---

# 23. Product Scope Rule

When deciding whether a feature belongs in the MVP, ask:

> Does this feature directly contribute to the core experience of text, voice, video or screen communication?

If the answer is no, it should generally be postponed.

The MVP should remain focused on proving the core real-time communication experience.
