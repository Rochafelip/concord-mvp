package com.concordmvp.channels.dto;

import com.concordmvp.channels.ChannelType;

import java.time.Instant;
import java.util.UUID;

/**
 * Also reused, as-is, as the WebSocket broadcast payload for {@code CHANNEL_CREATE} — its fields
 * already carry everything a client needs to know about the new channel, so there's no separate
 * {@code ChannelEventPayload}.
 */
public record ChannelResponse(
        UUID id,
        UUID serverId,
        String name,
        ChannelType type,
        Instant createdAt,
        Instant updatedAt
) {
}
