package com.concordmvp.auth;

import com.concordmvp.common.exception.UnauthorizedException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String TEST_SECRET = "test-secret-key-at-least-256-bits-long-for-hs256-signing!!";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(TEST_SECRET, 30);
    }

    @Test
    void generateAndParseToken_roundTripsUserId() {
        UUID userId = UUID.randomUUID();

        String token = jwtService.generateToken(userId);
        UUID parsed = jwtService.parseUserId(token);

        assertThat(parsed).isEqualTo(userId);
    }

    @Test
    void parseUserId_throwsUnauthorized_whenTokenIsTampered() {
        UUID userId = UUID.randomUUID();
        String token = jwtService.generateToken(userId);

        // Flip a character in the signature portion to invalidate it.
        char[] chars = token.toCharArray();
        int lastIndex = chars.length - 1;
        chars[lastIndex] = chars[lastIndex] == 'a' ? 'b' : 'a';
        String tampered = new String(chars);

        assertThatThrownBy(() -> jwtService.parseUserId(tampered))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void parseUserId_throwsUnauthorized_whenTokenIsExpired() {
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        Instant past = Instant.now().minusSeconds(3600);
        String expiredToken = Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .issuedAt(Date.from(past.minusSeconds(60)))
                .expiration(Date.from(past))
                .signWith(key)
                .compact();

        assertThatThrownBy(() -> jwtService.parseUserId(expiredToken))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void parseUserId_throwsUnauthorized_whenTokenIsMalformed() {
        assertThatThrownBy(() -> jwtService.parseUserId("not-a-valid-jwt"))
                .isInstanceOf(UnauthorizedException.class);
    }
}
