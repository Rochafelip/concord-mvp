package com.concordmvp.servers;

import java.util.Set;
import java.util.UUID;

/**
 * Published after a server's rows are deleted, inside the same transaction. Consumed by a
 * {@code @TransactionalEventListener(phase = AFTER_COMMIT)} so the WS broadcast only reaches
 * clients once the deletion has actually committed (see docs/DECISIONS.md / security audit A9).
 */
public record ServerDeletedEvent(UUID serverId, Set<UUID> recipientUserIds) {
}
