package com.concordmvp.users.dto;

import java.util.UUID;

/**
 * Shape returned for the authenticated user's own profile (GET /api/v1/users/me).
 */
public record MeResponse(
        UUID id,
        String username,
        String displayName,
        String email,
        String avatarUrl
) {
}
