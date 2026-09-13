package com.concordmvp.messages.dto;

import java.util.UUID;

public record MarkChannelReadRequest(
        UUID lastReadMessageId
) {
}
