package com.concordmvp.auth;

import com.concordmvp.common.exception.UnauthorizedException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and validates the application's single long-lived JWT access token (HS256).
 * No refresh token, no revocation list — see docs/DECISIONS.md D2.
 */
@Service
public class JwtService {

    public static final String COOKIE_NAME = "concord_session";

    private final SecretKey signingKey;
    private final long expirationDays;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-days:30}") long expirationDays
    ) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationDays = expirationDays;
    }

    public String generateToken(UUID userId) {
        Instant now = Instant.now();
        Instant expiry = now.plus(tokenTtl());
        return Jwts.builder()
                .subject(userId.toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    public UUID parseUserId(String token) {
        try {
            String subject = parseClaims(token).getSubject();
            if (subject == null) {
                throw new UnauthorizedException("Sessão inválida ou expirada");
            }
            return UUID.fromString(subject);
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Sessão inválida ou expirada");
        }
    }

    /**
     * The {@code jti} claim — how a specific token is identified in {@link JwtDenylist}.
     *
     * <p>Null for a token issued before {@code jti} was added to {@link #generateToken}: an
     * existing session cookie from before that change, not a malformed/tampered one, so it's
     * treated the same as any other unusable token rather than left to throw a raw NPE out of
     * {@link JwtAuthFilter} (which runs on every request, including public ones).
     */
    public UUID parseJti(String token) {
        try {
            String id = parseClaims(token).getId();
            if (id == null) {
                throw new UnauthorizedException("Sessão inválida ou expirada");
            }
            return UUID.fromString(id);
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Sessão inválida ou expirada");
        }
    }

    public Instant parseExpiration(String token) {
        try {
            Date expiration = parseClaims(token).getExpiration();
            if (expiration == null) {
                throw new UnauthorizedException("Sessão inválida ou expirada");
            }
            return expiration.toInstant();
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Sessão inválida ou expirada");
        }
    }

    public Instant parseIssuedAt(String token) {
        try {
            Date issuedAt = parseClaims(token).getIssuedAt();
            if (issuedAt == null) {
                throw new UnauthorizedException("Sessão inválida ou expirada");
            }
            return issuedAt.toInstant();
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Sessão inválida ou expirada");
        }
    }

    private io.jsonwebtoken.Claims parseClaims(String token) {
        return Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
    }

    /** The session cookie's Max-Age must match this so the cookie never outlives the JWT it holds. */
    public Duration tokenTtl() {
        return Duration.ofDays(expirationDays);
    }
}
