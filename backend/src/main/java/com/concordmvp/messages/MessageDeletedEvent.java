package com.concordmvp.messages;

import com.concordmvp.messages.dto.MessageDeletedPayload;

import java.util.Set;
import java.util.UUID;

/**
 * Published after a message row is deleted, inside the same transaction. Consumed by a
 * {@code @TransactionalEventListener(phase = AFTER_COMMIT)} so the WS broadcast only reaches
 * clients once the deletion has actually committed (same pattern as
 * {@code servers.ServerDeletedEvent}, security audit A9/Baixa follow-up).
 */
public record MessageDeletedEvent(Set<UUID> recipientUserIds, MessageDeletedPayload payload) {
}
