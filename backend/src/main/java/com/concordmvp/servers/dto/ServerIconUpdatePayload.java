package com.concordmvp.servers.dto;

import java.util.UUID;

/**
 * Realtime payload for {@code SERVER_ICON_UPDATE}.
 */
public record ServerIconUpdatePayload(UUID serverId, String iconUrl) {
}
