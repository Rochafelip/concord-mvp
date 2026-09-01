package com.concordmvp.realtime.dto;

/**
 * Payload for a {@link com.concordmvp.realtime.WsEventType#ERROR} event.
 */
public record ErrorPayload(String message) {
}
