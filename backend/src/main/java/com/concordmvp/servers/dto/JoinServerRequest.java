package com.concordmvp.servers.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinServerRequest(
        @NotBlank String code
) {
}
