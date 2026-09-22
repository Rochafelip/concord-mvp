package com.concordmvp.media.dto;

import java.util.UUID;

/**
 * Inbound {@code WHISTLE_START} frame: the sender arms a private whistle to
 * {@code targetUserId} within {@code channelId}. {@code WHISTLE_STOP} carries no payload —
 * the sender is identified from the authenticated session, mirroring {@code VOICE_PRESENCE_LEAVE}.
 */
public record WhistleStartRequest(UUID channelId, UUID targetUserId) {
}
