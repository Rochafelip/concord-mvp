package com.concordmvp.realtime;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WsTicketServiceTest {

    @Test
    void issueThenConsume_returnsTheIssuingUserId() {
        WsTicketService service = new WsTicketService(Clock.systemUTC());
        UUID userId = UUID.randomUUID();

        String ticket = service.issue(userId);

        assertThat(service.consume(ticket)).contains(userId);
    }

    @Test
    void consume_returnsEmpty_forUnknownTicket() {
        WsTicketService service = new WsTicketService(Clock.systemUTC());

        assertThat(service.consume("does-not-exist")).isEmpty();
    }

    @Test
    void consume_returnsEmpty_whenTicketAlreadyConsumed() {
        WsTicketService service = new WsTicketService(Clock.systemUTC());
        String ticket = service.issue(UUID.randomUUID());
        service.consume(ticket);

        assertThat(service.consume(ticket)).isEmpty();
    }

    @Test
    void consume_returnsEmpty_afterTtlElapses() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        WsTicketService service = new WsTicketService(clock);
        String ticket = service.issue(UUID.randomUUID());

        clock.advance(WsTicketService.TICKET_TTL.plusSeconds(1));

        assertThat(service.consume(ticket)).isEmpty();
    }

    @Test
    void issue_sweepsExpiredTickets_soTheStoreDoesNotGrowUnbounded() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        WsTicketService service = new WsTicketService(clock);
        service.issue(UUID.randomUUID());
        clock.advance(WsTicketService.TICKET_TTL.plusSeconds(1));

        service.issue(UUID.randomUUID());

        assertThat(service.ticketCount()).isEqualTo(1);
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
