/**
 * The application-level real-time event vocabulary sent over the WebSocket connection
 * (docs/ARCHITECTURE.md §16-17, backend com.concordmvp.realtime.WsEventType). MESSAGE_UPDATE,
 * MESSAGE_DELETE, and CHANNEL_UPDATE are part of the wire vocabulary but nothing in the backend
 * sends them yet (Phase 1 doesn't support editing, and channels can't be renamed) — they're kept
 * here for completeness/forward-compat, not because anything currently handles them.
 */
export type WsEventType =
  | 'MESSAGE_CREATE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE'
  | 'CHANNEL_CREATE'
  | 'CHANNEL_UPDATE'
  | 'CHANNEL_DELETE'
  | 'SERVER_MEMBER_JOIN'
  | 'SERVER_MEMBER_LEAVE'
  | 'SERVER_DELETE'
  | 'SERVER_OWNER_CHANGE'
  | 'VOICE_PRESENCE_UPDATE'
  | 'VOICE_PRESENCE_LEAVE'
  | 'ERROR';

/** Generic envelope for a WebSocket frame in both directions: {"type": "...", "payload": {...}}. */
export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
}

export interface ServerMemberEventPayload {
  serverId: string;
  userId: string;
}

export interface ServerOwnerChangePayload {
  serverId: string;
  newOwnerId: string;
}

export interface ServerDeletedPayload {
  serverId: string;
}

export interface ChannelDeletedPayload {
  channelId: string;
  serverId: string;
}

export interface ErrorPayload {
  message: string;
}

/** Wire shape of VOICE_PRESENCE_UPDATE — mirrors backend VoicePresenceResponse. */
export interface VoicePresencePayload {
  serverId: string;
  channelId: string;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  speaking: boolean;
}

export interface VoicePresenceLeavePayload {
  serverId: string;
  channelId: string;
  userId: string;
}
