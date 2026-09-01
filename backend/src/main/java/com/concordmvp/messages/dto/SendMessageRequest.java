package com.concordmvp.messages.dto;

import java.util.UUID;

/**
 * Shape of the inbound WebSocket payload for a {@code MESSAGE_CREATE} frame, i.e. the
 * {@code payload} field of {@code {"type": "MESSAGE_CREATE", "payload": {...}}}. Messages are
 * sent over WebSocket only — this is NOT a REST request body (docs/ARCHITECTURE.md §18).
 */
public record SendMessageRequest(
        UUID channelId,
        String content
) {
}
