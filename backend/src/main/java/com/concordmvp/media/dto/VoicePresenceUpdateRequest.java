package com.concordmvp.media.dto;

import java.util.UUID;

/**
 * Inbound frame sent by a client already connected to a voice channel, reporting its own local
 * participant's current state (docs/superpowers/specs/2026-09-04-voice-channel-participant-preview-design.md §3.3).
 */
public record VoicePresenceUpdateRequest(
        UUID channelId,
        boolean muted,
        boolean cameraOn,
        boolean screenSharing,
        boolean speaking
) {
}
