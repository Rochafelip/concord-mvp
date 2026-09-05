package com.concordmvp.channels.dto;

import java.util.UUID;

/**
 * Realtime payload for {@code CHANNEL_DELETE}.
 */
public record ChannelDeletedPayload(UUID channelId, UUID serverId) {
}
