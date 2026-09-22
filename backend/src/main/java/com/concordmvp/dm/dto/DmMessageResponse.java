package com.concordmvp.dm.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.time.Instant;
import java.util.UUID;

/**
 * Used both as the REST response shape for DM history and as the {@code DM_MESSAGE_CREATE}
 * WebSocket payload. {@code recipientId} is the other participant relative to {@code author} —
 * a client viewing the conversation resolves which side is "the other person" by comparing
 * {@code author.id} to its own user id, since the same event is broadcast unchanged to both
 * participants.
 */
public record DmMessageResponse(
        UUID id,
        UserSummaryResponse author,
        UUID recipientId,
        String content,
        Instant createdAt
) {
}
