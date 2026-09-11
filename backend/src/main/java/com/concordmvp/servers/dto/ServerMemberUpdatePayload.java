package com.concordmvp.servers.dto;

import java.util.UUID;

public record ServerMemberUpdatePayload(
        UUID serverId,
        UUID userId,
        String displayName
) {
}
