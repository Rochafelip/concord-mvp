package com.concordmvp.friends.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.time.Instant;
import java.util.UUID;

/** A pending friend request, from either the incoming or outgoing side. */
public record FriendRequestResponse(
        UUID friendshipId,
        UserSummaryResponse user,
        Instant createdAt
) {
}
