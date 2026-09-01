package com.concordmvp.auth;

import com.concordmvp.common.exception.UnauthorizedException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and validates the application's single long-lived JWT access token (HS256).
 * No refresh token, no revocation list — see docs/DECISIONS.md D2.
 */
@Service
public class JwtService {

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
        Instant expiry = now.plus(java.time.Duration.ofDays(expirationDays));
        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey)
                .compact();
    }

    public UUID parseUserId(String token) {
        try {
            String subject = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getSubject();
            return UUID.fromString(subject);
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Invalid or expired token");
        }
    }
}
