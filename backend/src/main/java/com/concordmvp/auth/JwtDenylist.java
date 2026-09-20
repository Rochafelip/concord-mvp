package com.concordmvp.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Revoked JWTs, keyed by their {@code jti} claim, kept until they would have expired anyway.
 * In memory rather than a database table or Redis, per docs/DECISIONS.md D3 — a backend restart
 * un-revokes any token whose owner had just logged out, which is an acceptable gap for a single
 * self-hosted instance (see D2's revision: server-side revocation was added specifically to
 * bound how long a stolen token stays usable after logout, at the cost of this restart edge case).
 */
@Component
public class JwtDenylist {

    private final Map<UUID, Instant> revokedUntil = new ConcurrentHashMap<>();

    public void revoke(UUID jti, Instant tokenExpiresAt) {
        prune();
        revokedUntil.put(jti, tokenExpiresAt);
    }

    public boolean isRevoked(UUID jti) {
        return revokedUntil.containsKey(jti);
    }

    /** Runs on every revoke() so the map never grows past the count of still-valid tokens. */
    private void prune() {
        Instant now = Instant.now();
        revokedUntil.values().removeIf(expiresAt -> expiresAt.isBefore(now));
    }
}
