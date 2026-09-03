package com.concordmvp.media.dto;

/**
 * Credentials the frontend needs to connect to a voice channel's LiveKit room via
 * {@code livekit-client}'s {@code Room.connect(url, token)}.
 */
public record VoiceTokenResponse(String token, String url, String roomName) {
}
