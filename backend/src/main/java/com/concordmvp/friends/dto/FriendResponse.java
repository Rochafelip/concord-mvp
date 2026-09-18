package com.concordmvp.friends.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.time.Instant;
import java.util.UUID;

public record FriendResponse(
        UUID friendshipId,
        UserSummaryResponse user,
        boolean online,
        Instant since
) {
}
