package com.concordmvp.auth;

import com.concordmvp.common.exception.UnauthorizedException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.WebUtils;

import java.io.IOException;
import java.util.Collections;
import java.util.UUID;

/**
 * Reads the {@link JwtService#COOKIE_NAME} cookie, if present, and populates the security
 * context with the authenticated user's id. Never rejects the request itself — a missing or
 * invalid token simply leaves the request unauthenticated, and the security filter chain's
 * authorization rules (plus the custom entry point) are responsible for turning that into a
 * 401 for protected endpoints.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        Cookie cookie = WebUtils.getCookie(request, JwtService.COOKIE_NAME);

        if (cookie != null) {
            try {
                UUID userId = jwtService.parseUserId(cookie.getValue());
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (UnauthorizedException e) {
                // Invalid/expired/malformed token: leave the request unauthenticated and let
                // downstream authorization handle the 401 response.
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }
}
