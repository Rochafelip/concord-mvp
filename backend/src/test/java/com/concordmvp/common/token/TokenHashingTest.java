package com.concordmvp.common.token;

import org.junit.jupiter.api.Test;

import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class TokenHashingTest {

    @Test
    void generatesADistinctTokenEveryTime() {
        var tokens = IntStream.range(0, 100)
                .mapToObj(i -> TokenHashing.generateToken())
                .collect(Collectors.toSet());

        assertThat(tokens).hasSize(100);
    }

    @Test
    void generatesUrlSafeTokens() {
        // base64url, not plain base64: a '+' or '/' riding in a query string would be
        // reinterpreted and the emailed link would arrive corrupted.
        assertThat(TokenHashing.generateToken()).matches("[A-Za-z0-9_-]+");
    }

    @Test
    void hashesDeterministically() {
        String token = TokenHashing.generateToken();

        assertThat(TokenHashing.hash(token)).isEqualTo(TokenHashing.hash(token));
    }

    @Test
    void hashDoesNotRevealTheToken() {
        String token = TokenHashing.generateToken();

        String hash = TokenHashing.hash(token);
        assertThat(hash).isNotEqualTo(token);
        assertThat(hash).doesNotContain(token);
        assertThat(hash).hasSize(64);
    }

    @Test
    void differentTokensHashDifferently() {
        assertThat(TokenHashing.hash("token-a")).isNotEqualTo(TokenHashing.hash("token-b"));
    }
}
