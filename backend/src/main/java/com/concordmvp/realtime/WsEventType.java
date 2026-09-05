package com.concordmvp.realtime;

/**
 * The application-level real-time event vocabulary sent over the WebSocket connection.
 * See docs/ARCHITECTURE.md §16 and docs/DECISIONS.md D15.
 */
public enum WsEventType {
    MESSAGE_CREATE,
    MESSAGE_UPDATE,
    MESSAGE_DELETE,
    CHANNEL_CREATE,
    CHANNEL_UPDATE,
    CHANNEL_DELETE,
    SERVER_MEMBER_JOIN,
    SERVER_MEMBER_LEAVE,
    SERVER_DELETE,
    SERVER_OWNER_CHANGE,
    VOICE_PRESENCE_UPDATE,
    VOICE_PRESENCE_LEAVE,
    ERROR
}
