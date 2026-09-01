package com.concordmvp.servers.dto;

import java.util.UUID;

/**
 * Realtime payload for {@code SERVER_DELETE}.
 */
public record ServerDeletedPayload(UUID serverId) {
}
