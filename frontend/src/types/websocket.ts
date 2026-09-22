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
  | 'CHANNEL_READ'
  | 'SERVER_MEMBER_JOIN'
  | 'SERVER_MEMBER_LEAVE'
  | 'SERVER_MEMBER_UPDATE'
  | 'SERVER_DELETE'
  | 'SERVER_OWNER_CHANGE'
  | 'VOICE_PRESENCE_UPDATE'
  | 'VOICE_PRESENCE_LEAVE'
  | 'VOICE_KICK'
  | 'WHISTLE_START'
  | 'WHISTLE_STOP'
  | 'USER_PROFILE_UPDATE'
  | 'PERMISSIONS_UPDATE'
  | 'FRIEND_UPDATE'
  | 'DM_MESSAGE_CREATE'
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

export interface ServerMemberUpdatePayload {
  serverId: string;
  userId: string;
  displayName: string;
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

export interface MessageDeletedPayload {
  messageId: string;
  channelId: string;
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
  deafened: boolean;
}

export interface VoicePresenceLeavePayload {
  serverId: string;
  channelId: string;
  userId: string;
}

export interface UserProfileUpdatePayload {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
/**
 * Deliberately thin: the client reacts by refetching, and every GET already returns the caller's
 * own effective permissions. A per-recipient payload would have to be computed per socket.
 */
export interface PermissionsUpdatePayload {
  serverId: string;
}

export interface ChannelReadPayload {
  channelId: string;
  userId: string;
  lastReadMessageId: string | null;
  unreadCount: number;
}

export type VoiceKickPayload = string;

/** Wire shape of WHISTLE_START/WHISTLE_STOP — sent only to the sender and target. */
export interface WhistlePayload {
  channelId: string;
  senderId: string;
  targetUserId: string;
}

/**
 * Generic "something about this friendship changed, refetch" signal — same shape as
 * PermissionsUpdatePayload's reasoning. Covers a request being created, accepted, cancelled,
 * declined, or a friendship being removed.
 */
export interface FriendUpdatePayload {
  userId: string;
  otherUserId: string;
}
