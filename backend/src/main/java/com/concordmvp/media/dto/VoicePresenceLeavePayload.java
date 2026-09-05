package com.concordmvp.media.dto;

import java.util.UUID;

/** Payload of VOICE_PRESENCE_LEAVE. */
public record VoicePresenceLeavePayload(UUID serverId, UUID channelId, UUID userId) {
}
