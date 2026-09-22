package com.concordmvp.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the caller's IP for rate limiting. The backend has no host port exposed (see
 * infrastructure/docker-compose.yml) — nginx is the only thing that can reach it directly, so
 * its X-Real-IP/X-Forwarded-For headers can be trusted here without a spoofing risk.
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String resolve(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }
}
