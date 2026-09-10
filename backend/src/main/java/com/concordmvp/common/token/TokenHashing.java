package com.concordmvp.common.token;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Single-use tokens for email verification and password reset.
 *
 * The raw token travels in the emailed link; only its SHA-256 is ever stored. A database leak
 * must not hand an attacker usable reset links -- the same reason password hashes exist. Lookups
 * therefore hash the incoming token and query by that.
 *
 * Plain SHA-256 rather than BCrypt here on purpose: these are 256 bits of SecureRandom output, so
 * there is no dictionary to attack and nothing a deliberately slow hash would protect against,
 * while this lookup runs on every click of an emailed link.
 */
public final class TokenHashing {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private TokenHashing() {
    }

    /** base64url, so the value survives a trip through a query string unchanged. */
    public static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the JVM spec", e);
        }
    }
}
