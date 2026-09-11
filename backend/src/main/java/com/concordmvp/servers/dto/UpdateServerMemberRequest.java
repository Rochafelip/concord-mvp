package com.concordmvp.servers.dto;

import jakarta.validation.constraints.Size;

public record UpdateServerMemberRequest(
        @Size(max = 50, message = "Display name must be at most 50 characters")
        String displayName
) {
}
