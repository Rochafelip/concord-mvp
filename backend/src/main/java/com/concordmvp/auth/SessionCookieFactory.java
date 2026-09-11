package com.concordmvp.auth;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class SessionCookieFactory {

    private final JwtService jwtService;

    public SessionCookieFactory(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    public ResponseCookie create(String token) {
        return ResponseCookie.from(JwtService.COOKIE_NAME, token)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(jwtService.tokenTtl())
                .build();
    }

    public ResponseCookie clear() {
        return ResponseCookie.from(JwtService.COOKIE_NAME, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
    }
}
