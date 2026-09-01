package com.concordmvp.servers.dto;

import java.util.UUID;

/**
 * Realtime payload for both {@code SERVER_MEMBER_JOIN} and {@code SERVER_MEMBER_LEAVE}.
 */
public record ServerMemberEventPayload(UUID serverId, UUID userId) {
}
