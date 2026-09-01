package com.concordmvp.messages.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.time.Instant;
import java.util.UUID;

/**
 * Used both as the REST response shape for message history and, as-is, as the WebSocket
 * broadcast payload for {@code MESSAGE_CREATE} — same reasoning as {@code ChannelResponse}'s
 * reuse for {@code CHANNEL_CREATE}, no separate event payload DTO.
 */
public record MessageResponse(
        UUID id,
        UUID channelId,
        UserSummaryResponse author,
        String content,
        Instant createdAt
) {
}
