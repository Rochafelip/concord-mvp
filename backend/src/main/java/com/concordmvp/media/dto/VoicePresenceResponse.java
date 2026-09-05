package com.concordmvp.media.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.util.UUID;

/**
 * One participant's voice presence — both a REST snapshot list item and the payload of
 * VOICE_PRESENCE_UPDATE. Carries serverId even though a REST caller already knows it from the
 * URL path, because the same record doubles as the WS broadcast payload, and a WS event needs
 * serverId to tell the frontend which server's cache to update (same reasoning as the existing
 * ServerMemberEventPayload).
 */
public record VoicePresenceResponse(
        UUID serverId,
        UUID channelId,
        UserSummaryResponse user,
        boolean muted,
        boolean cameraOn,
        boolean screenSharing,
        boolean speaking
) {
}
