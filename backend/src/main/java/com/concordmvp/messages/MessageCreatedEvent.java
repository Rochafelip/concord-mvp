package com.concordmvp.messages;

import com.concordmvp.messages.dto.MessageResponse;

import java.util.Set;
import java.util.UUID;

/**
 * Published after a message's rows are saved, inside the same transaction. Consumed by a
 * {@code @TransactionalEventListener(phase = AFTER_COMMIT)} so the WS broadcast only reaches
 * clients once the message has actually committed (same pattern as
 * {@code servers.ServerDeletedEvent}, security audit A9/Baixa follow-up).
 */
public record MessageCreatedEvent(Set<UUID> recipientUserIds, MessageResponse payload) {
}
