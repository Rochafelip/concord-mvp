package com.concordmvp.messages.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Used both as the REST response shape for message history and, as-is, as the WebSocket
 * broadcast payload for {@code MESSAGE_CREATE} — same reasoning as {@code ChannelResponse}'s
 * reuse for {@code CHANNEL_CREATE}, no separate event payload DTO.
 *
 * <p>{@code attachments} is always present and ordered by the sender's original ordering; it is
 * an empty list for a text-only message, never {@code null}.
 */
public record MessageResponse(
        UUID id,
        UUID channelId,
        UserSummaryResponse author,
        String content,
        List<AttachmentResponse> attachments,
        Instant createdAt
) {
}
