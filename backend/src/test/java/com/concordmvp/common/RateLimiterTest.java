package com.concordmvp.common;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The clock is a parameter so these can assert windowing without sleeping.
 */
class RateLimiterTest {

    private static final Instant NOW = Instant.parse("2026-09-10T10:00:00Z");

    private RateLimiter limiter() {
        return new RateLimiter(1, Duration.ofMinutes(1), 5, Duration.ofHours(1));
    }

    @Test
    void allowsTheFirstAttempt() {
        assertThat(limiter().tryAcquire("a@b.com", NOW)).isTrue();
    }

    @Test
    void blocksASecondAttemptInsideTheShortWindow() {
        RateLimiter limiter = limiter();
        limiter.tryAcquire("a@b.com", NOW);

        assertThat(limiter.tryAcquire("a@b.com", NOW.plusSeconds(30))).isFalse();
    }

    @Test
    void allowsAgainOnceTheShortWindowPasses() {
        RateLimiter limiter = limiter();
        limiter.tryAcquire("a@b.com", NOW);

        assertThat(limiter.tryAcquire("a@b.com", NOW.plusSeconds(61))).isTrue();
    }

    @Test
    void blocksOnceTheLongWindowLimitIsReached() {
        RateLimiter limiter = limiter();
        for (int i = 0; i < 5; i++) {
            assertThat(limiter.tryAcquire("a@b.com", NOW.plusSeconds(i * 61L))).isTrue();
        }

        assertThat(limiter.tryAcquire("a@b.com", NOW.plusSeconds(5 * 61L))).isFalse();
    }

    @Test
    void allowsAgainOnceTheLongWindowRollsOff() {
        RateLimiter limiter = limiter();
        for (int i = 0; i < 5; i++) {
            limiter.tryAcquire("a@b.com", NOW.plusSeconds(i * 61L));
        }

        assertThat(limiter.tryAcquire("a@b.com", NOW.plusSeconds(3700))).isTrue();
    }

    @Test
    void tracksEachKeyIndependently() {
        RateLimiter limiter = limiter();
        limiter.tryAcquire("a@b.com", NOW);

        assertThat(limiter.tryAcquire("other@b.com", NOW)).isTrue();
    }
}
