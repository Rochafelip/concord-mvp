package com.concordmvp.users.dto;

import java.util.UUID;

/**
 * Minimal user shape used when referencing a user from other DTOs (e.g. a message author,
 * a server member).
 */
public record UserSummaryResponse(
        UUID id,
        String username,
        String displayName,
        String avatarUrl
) {
}
