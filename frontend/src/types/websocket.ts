/**
 * The application-level real-time event vocabulary sent over the WebSocket connection
 * (docs/ARCHITECTURE.md §16-17, backend com.concordmvp.realtime.WsEventType). MESSAGE_UPDATE,
 * MESSAGE_DELETE, CHANNEL_UPDATE, and CHANNEL_DELETE are part of the wire vocabulary but nothing
 * in the backend sends them yet (Phase 1 doesn't support editing/deleting) — they're kept here
 * for completeness/forward-compat, not because anything currently handles them.
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

export interface ErrorPayload {
  message: string;
}
