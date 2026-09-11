# Concord User Avatar and Settings Design

**Date:** 2026-09-11  
**Status:** Design approved in brainstorming; awaiting written-spec review

## 1. Objective and scope

Evolve the existing user model so users can add, replace, remove, and view a
profile avatar without breaking existing accounts. The first settings slice is
the Profile section only: avatar, username, and display name. Account,
Appearance, and Voice & Video remain explicit extension points, but their
settings are not implemented in this change.

The feature must use Concord's existing visual language, keep avatar data
optional, avoid exposing private account data, and propagate profile changes
without logout/login.

## 2. Current-state analysis

### Backend

- `users.User` already contains `id`, `username`, `displayName`, `email`,
  `passwordHash`, nullable `avatarUrl`, `emailVerified`, password/session
  timestamps, and audit timestamps.
- `V1__create_users.sql` already creates nullable `avatar_url`; there is no
  avatar upload or delete operation today.
- `GET /api/v1/users/me` returns `MeResponse`, including email, verification
  status, and nullable `avatarUrl`.
- `PATCH /api/v1/users/me` updates username and display name.
- `PUT /api/v1/users/me/password` changes the password and rotates the
  session cookie.
- `UserSummaryResponse` is the intentionally smaller user shape used by
  messages, server members, and voice presence. It currently includes
  `id`, `username`, `displayName`, and nullable `avatarUrl`.
- `MessageResponse`, `ServerMemberResponse`, and `VoicePresenceResponse`
  already carry `UserSummaryResponse`, so avatar changes can flow through
  existing user references.
- JWTs contain only the user id; avatar data must not be added to claims.
- Upload infrastructure already provides a Docker-managed `/app/uploads`
  volume and authenticated upload-serving routes for message attachments.
  There is no S3-compatible service in the current deployment.

### Frontend

- `types/user.ts` already models nullable `avatarUrl`.
- `components/Avatar.tsx` is reusable and currently renders an image or a
  brand-colored initial fallback.
- The avatar is already used in the app shell, message list, and call
  participant UI; other user references use the same summary fields.
- `authStore` persists the current user and `useUpdateProfile` replaces it
  after a successful profile update.
- `features/settings/SettingsPage.tsx` already has Profile and Password
  forms plus Audio settings. Profile currently has no avatar controls.
- The WebSocket vocabulary has message, channel, server-membership, and voice
  presence events, but no user-profile event.

## 3. Decisions

### Storage

Use the existing private local volume for the MVP. Store avatar bytes under a
user-scoped directory such as:

```text
/app/uploads/avatars/{userId}/{opaque-file-id}
```

The original filename is never used as a path. The database stores only an
opaque storage key, not image bytes. The current nullable `avatar_url` column
is migrated to the clearer `avatar_storage_key` name while preserving
`NULL` for all existing users. The API field remains `avatarUrl` for client
compatibility and is derived from the authenticated avatar endpoint.

The storage service boundary should make a future S3-compatible adapter
possible, but no object-storage dependency is introduced now.

### Visibility and API exposure

Avatar bytes are available only through an authenticated endpoint. Any
authenticated user who is already allowed to receive a user summary (server
members, messages, or voice presence) may request the avatar. There is no
anonymous public avatar URL.

`MeResponse` may expose email and verification state only for the current
user. `UserSummaryResponse` remains limited to public-in-context identity
fields. Password hashes, password timestamps, and other account internals are
never serialized.

### Validation

Avatar uploads accept JPEG, PNG, GIF, and WebP up to 5 MB. Validation must
check the declared MIME type, extension, byte size, and actual decodability
with an image reader; extension or MIME alone is insufficient. Corrupted,
empty, mismatched, or unsupported content is rejected. The server generates
the stored filename/identifier and never trusts the client filename.

## 4. API and realtime contracts

Existing contracts remain:

```text
GET   /api/v1/users/me
PATCH /api/v1/users/me              { username, displayName }
```

Add:

```text
PUT    /api/v1/users/me/avatar      multipart/form-data, field: file
DELETE /api/v1/users/me/avatar
GET    /api/v1/users/{userId}/avatar
```

The avatar `GET` endpoint checks authentication and serves the stored bytes
with a detected safe content type and cache headers suitable for an
identity-based resource. Missing avatars return `404`; clients render the
Concord fallback. Upload returns the updated `MeResponse`; delete returns
`204 No Content`. Invalid content returns `400`, and a request exceeding the
limit returns `413`, using the existing error response conventions.

Add `USER_PROFILE_UPDATE` to the WebSocket event vocabulary:

```json
{
  "type": "USER_PROFILE_UPDATE",
  "payload": {
    "user": {
      "id": "user-id",
      "username": "name",
      "displayName": "Display name",
      "avatarUrl": "/api/v1/users/user-id/avatar"
    }
  }
}
```

The event is emitted after the database and file operation succeed. The
frontend updates the authenticated user and replaces matching user summaries
in message, member, and voice-presence caches by id. Call participant views
must use the same current summary/avatar data and do not require a new JWT.

## 5. Frontend design

### Reusable Avatar

Extend `Avatar` with explicit loading/error behavior while preserving the
existing `sm`, `md`, and `lg` sizes. A missing or failed image renders the
existing Concord visual language using the `ConcordMark` centered in a
rounded avatar with brand/accent palette colors. The component keeps an
accessible name based on display name and does not rely on Discord styling.

### Profile settings

Add an avatar card to the existing Profile section:

- current avatar preview;
- `Adicionar`/`Alterar` file action;
- `Remover` when an avatar exists;
- client-side size/type feedback before submission;
- pending/loading state that disables conflicting actions;
- success, invalid-file, too-large, connection, and server-error messages;
- fallback rendering while the image is loading or unavailable.

Only Profile is functional. Future Account, Appearance, and Voice & Video
boundaries should be represented in code/module organization rather than as
inactive controls that suggest unsupported behavior.

## 6. Error handling and replacement lifecycle

1. Receive multipart upload and enforce request-size and file-size limits.
2. Validate filename metadata, MIME, extension, and decoded image content.
3. Generate a new opaque key and write to the user-scoped directory.
4. Persist the new key in the user transaction.
5. Publish `USER_PROFILE_UPDATE`.
6. Remove the previous file only after the new record is safely persisted.

If validation or storage fails, surface the error and leave the current avatar
unchanged. Delete clears the database key, publishes the update, and removes
the old file. File cleanup failures must be surfaced/logged according to
existing backend conventions rather than silently reported as success.

## 7. Testing and documentation

Backend tests cover:

- valid JPEG/PNG/GIF/WebP uploads;
- MIME/extension/content mismatches;
- corrupted, empty, oversized, and maliciously named files;
- create, replace, delete, missing-avatar, and failed-storage behavior;
- authenticated access and response content type;
- DTO privacy and `USER_PROFILE_UPDATE` publication.

Frontend tests cover:

- ConcordMark fallback, image rendering, image-load failure, and loading;
- settings upload, replacement, removal, pending, success, and error states;
- realtime replacement of the current user and referenced summaries;
- preservation of existing no-avatar users and call/message rendering.

Update the architecture/database decision documentation to record local
avatar storage, authenticated serving, the 5 MB policy, and the realtime
event. The implementation plan must include the current-user flow through
authentication, servers/channels, messages, voice presence, and calls.

