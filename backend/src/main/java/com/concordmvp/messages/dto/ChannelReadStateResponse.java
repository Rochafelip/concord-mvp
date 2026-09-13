package com.concordmvp.messages.dto;

import java.time.Instant;
import java.util.UUID;

public record ChannelReadStateResponse(
        UUID channelId,
        UUID lastReadMessageId,
        Instant lastReadAt,
        Integer unreadCount
) {
}
