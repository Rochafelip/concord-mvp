package com.concordmvp.friends.dto;

import java.util.List;

public record PendingFriendRequestsResponse(
        List<FriendRequestResponse> incoming,
        List<FriendRequestResponse> outgoing
) {
}
