package com.concordmvp.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtDenylistTest {

    private final JwtDenylist denylist = new JwtDenylist();

    @Test
    void aJtiThatWasNeverRevokedIsNotRevoked() {
        assertThat(denylist.isRevoked(UUID.randomUUID())).isFalse();
    }

    @Test
    void aRevokedJtiIsRevoked() {
        UUID jti = UUID.randomUUID();

        denylist.revoke(jti, Instant.now().plus(30, ChronoUnit.DAYS));

        assertThat(denylist.isRevoked(jti)).isTrue();
    }

    @Test
    void revokingOneJtiDoesNotAffectAnother() {
        UUID revoked = UUID.randomUUID();
        UUID other = UUID.randomUUID();

        denylist.revoke(revoked, Instant.now().plus(30, ChronoUnit.DAYS));

        assertThat(denylist.isRevoked(other)).isFalse();
    }

    @Test
    void anEntryIsPrunedOnceItsTokenWouldHaveExpiredAnyway() {
        // The entry's own expiry, not wall-clock waiting, is what makes it prunable — pruning
        // runs as a side effect of the next revoke() call, mirroring RateLimiter's cleanup.
        UUID alreadyExpired = UUID.randomUUID();
        denylist.revoke(alreadyExpired, Instant.now().minus(1, ChronoUnit.SECONDS));

        denylist.revoke(UUID.randomUUID(), Instant.now().plus(30, ChronoUnit.DAYS));

        assertThat(denylist.isRevoked(alreadyExpired)).isFalse();
    }
}
