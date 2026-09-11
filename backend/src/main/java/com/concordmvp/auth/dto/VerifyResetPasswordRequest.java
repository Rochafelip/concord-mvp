package com.concordmvp.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyResetPasswordRequest(@NotBlank String token) {
}
