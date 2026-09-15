package com.concordmvp.messages.dto;

import java.util.List;
import java.util.UUID;

/**
 * Shape of the inbound WebSocket payload for a {@code MESSAGE_CREATE} frame, i.e. the
 * {@code payload} field of {@code {"type": "MESSAGE_CREATE", "payload": {...}}}. Messages are
 * sent over WebSocket only — this is NOT a REST request body (docs/ARCHITECTURE.md §18).
 *
 * <p>{@code attachments} may be absent or {@code null} on the wire (a text-only message);
 * {@code MessageService} normalizes that to an empty list.
 */
public record SendMessageRequest(
        UUID channelId,
        String content,
        List<AttachmentRequest> attachments
) {
}
