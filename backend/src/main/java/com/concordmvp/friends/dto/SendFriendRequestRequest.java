package com.concordmvp.friends.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SendFriendRequestRequest(
        @NotNull UUID addresseeId
) {
}
