package com.concordmvp.messages.dto;

import java.util.UUID;

public record MessageDeletedPayload(UUID messageId, UUID channelId) {
}
