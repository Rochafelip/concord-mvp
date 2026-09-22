package com.concordmvp.media.dto;

import java.util.UUID;

/** Broadcast on {@code WHISTLE_START}/{@code WHISTLE_STOP}, sent only to the sender and target. */
public record WhistlePayload(UUID channelId, UUID senderId, UUID targetUserId) {
}
