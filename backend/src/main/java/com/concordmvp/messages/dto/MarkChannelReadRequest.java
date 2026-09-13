package com.concordmvp.messages.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record MarkChannelReadRequest(
    @NotNull UUID lastReadMessageId
) {}
