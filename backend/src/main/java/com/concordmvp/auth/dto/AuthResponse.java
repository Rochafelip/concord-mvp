package com.concordmvp.auth.dto;

import java.util.UUID;

public record AuthResponse(
        UUID userId,
        String username,
        String displayName,
        String email
) {
}
