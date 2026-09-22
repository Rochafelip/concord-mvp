package com.concordmvp.dm.dto;

import java.util.UUID;

/** Inbound {@code DM_MESSAGE_CREATE} WebSocket payload — see {@code ChatWebSocketHandler}. */
public record SendDmMessageRequest(
        UUID recipientId,
        String content
) {
}
