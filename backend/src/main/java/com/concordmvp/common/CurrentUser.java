package com.concordmvp.common;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/**
 * Single place that knows how to read the authenticated user's id out of the security context.
 * {@link com.concordmvp.auth.JwtAuthFilter} sets the principal to the user's {@link UUID}; this
 * is the one spot that assumption lives so controllers don't each re-derive it.
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    /**
     * Returns the authenticated user's id from the current {@link SecurityContextHolder} context.
     */
    public static UUID id() {
        return id(SecurityContextHolder.getContext().getAuthentication());
    }

    /**
     * Returns the authenticated user's id from the given {@link Authentication}.
     */
    public static UUID id(Authentication authentication) {
        return (UUID) authentication.getPrincipal();
    }
}
