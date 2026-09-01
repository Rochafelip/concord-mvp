package com.concordmvp.servers.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateServerRequest(
        @NotBlank @Size(max = 100) String name
) {
}
