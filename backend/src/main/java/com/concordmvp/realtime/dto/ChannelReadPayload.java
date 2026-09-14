package com.concordmvp.realtime.dto;

import java.util.UUID;

/**
 * Payload for a {@link com.concordmvp.realtime.WsEventType#CHANNEL_READ} event.
 * Broadcast when a user marks a channel as read, allowing other clients to sync unread counts.
 */
public record ChannelReadPayload(
    UUID channelId,
    UUID userId,
    UUID lastReadMessageId,
    Integer unreadCount
) {
}
