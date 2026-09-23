package com.concordmvp.servers.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ServerResponse(
        UUID id,
        String name,
        UUID ownerId,
        Instant createdAt,
        Instant updatedAt,
        String iconUrl,
        /** The requesting user's effective permissions on this server, as permission names. */
        List<String> permissions
) {
}
