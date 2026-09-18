package com.concordmvp.servers.dto;

import java.util.UUID;

public record InvitePreview(UUID serverId, String serverName, int memberCount) {
}
