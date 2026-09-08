package com.concordmvp.realtime;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Short-lived, single-use tickets used to authenticate the {@code /ws} handshake without ever
 * putting the app's long-lived JWT in the WebSocket URL (see RealtimeController and
 * {@link JwtHandshakeInterceptor}). A ticket is minted for the caller's user id via an
 * authenticated REST call, then spent exactly once at handshake time.
 *
 * <p>In-memory only, no Redis/DB — same reasoning as {@link WebSocketSessionRegistry}: the app
 * runs as a single instance (docs/DECISIONS.md D3), and a 30s TTL keeps the map from growing
 * unbounded even without a scheduled cleanup task.
 */
@Component
public class WsTicketService {

    static final Duration TICKET_TTL = Duration.ofSeconds(30);

    private final Clock clock;
    private final ConcurrentHashMap<String, TicketEntry> ticketsById = new ConcurrentHashMap<>();

    public WsTicketService() {
        this(Clock.systemUTC());
    }

    WsTicketService(Clock clock) {
        this.clock = clock;
    }

    /**
     * Mints a new ticket for {@code userId}, valid for {@link #TICKET_TTL}.
     */
    public String issue(UUID userId) {
        sweepExpired();
        String ticket = UUID.randomUUID().toString();
        ticketsById.put(ticket, new TicketEntry(userId, Instant.now(clock).plus(TICKET_TTL)));
        return ticket;
    }

    /**
     * Spends {@code ticket}, returning the user id it was issued for — or empty if the ticket
     * is unknown, already spent, or expired. Either way the ticket is removed: this call is
     * its only chance to succeed.
     */
    public Optional<UUID> consume(String ticket) {
        TicketEntry entry = ticketsById.remove(ticket);
        if (entry == null || entry.expiresAt().isBefore(Instant.now(clock))) {
            return Optional.empty();
        }
        return Optional.of(entry.userId());
    }

    /**
     * Test-only visibility into how many tickets are currently outstanding.
     */
    int ticketCount() {
        return ticketsById.size();
    }

    private void sweepExpired() {
        Instant now = Instant.now(clock);
        ticketsById.values().removeIf(entry -> entry.expiresAt().isBefore(now));
    }

    private record TicketEntry(UUID userId, Instant expiresAt) {
    }
}
