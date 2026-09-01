package com.concordmvp.realtime;

/**
 * Generic envelope for a WebSocket event, serialized to JSON as:
 * {@code {"type": "...", "payload": {...}}} — matching the wire format documented in
 * docs/ARCHITECTURE.md §17.
 */
public record WsEvent(WsEventType type, Object payload) {
}
