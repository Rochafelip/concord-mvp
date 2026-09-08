package com.concordmvp.users.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank @Size(max = 50) String username,
        @NotBlank @Size(max = 50) String displayName
) {
}
