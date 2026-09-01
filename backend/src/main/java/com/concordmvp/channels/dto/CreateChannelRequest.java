package com.concordmvp.channels.dto;

import com.concordmvp.channels.ChannelType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateChannelRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull ChannelType type
) {
}
