package com.concordmvp.servers.dto;

import java.time.Instant;
import java.util.UUID;

public record ServerResponse(
        UUID id,
        String name,
        UUID ownerId,
        Instant createdAt,
        Instant updatedAt
) {
}
