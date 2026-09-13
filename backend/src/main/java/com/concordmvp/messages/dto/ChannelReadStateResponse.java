package com.concordmvp.messages.dto;

import java.time.Instant;
import java.util.UUID;

public record ChannelReadStateResponse(
    UUID id,
    UUID userId,
    UUID channelId,
    UUID lastReadMessageId,
    Instant lastReadAt,
    Integer unreadCount,
    Instant createdAt,
    Instant updatedAt
) {}
