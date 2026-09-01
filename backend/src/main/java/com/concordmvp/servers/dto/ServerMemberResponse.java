package com.concordmvp.servers.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.time.Instant;

public record ServerMemberResponse(
        UserSummaryResponse user,
        Instant joinedAt
) {
}
