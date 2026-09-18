package com.concordmvp.friends.dto;

import java.util.UUID;

/**
 * Realtime payload for {@code FRIEND_UPDATE} — a generic "something about this friendship
 * changed, refetch" signal (same pattern as {@code PERMISSIONS_UPDATE}), covering a request
 * being created, accepted, cancelled, declined, or a friendship being removed. Carries the two
 * user ids involved so a client can skip refetching if neither is relevant to what it has open,
 * but is not itself the source of truth for what changed.
 */
public record FriendUpdatePayload(UUID userId, UUID otherUserId) {
}
