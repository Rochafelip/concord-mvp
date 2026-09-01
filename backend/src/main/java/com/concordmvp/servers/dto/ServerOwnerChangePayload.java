package com.concordmvp.servers.dto;

import java.util.UUID;

/**
 * Realtime payload for {@code SERVER_OWNER_CHANGE}.
 */
public record ServerOwnerChangePayload(UUID serverId, UUID newOwnerId) {
}
