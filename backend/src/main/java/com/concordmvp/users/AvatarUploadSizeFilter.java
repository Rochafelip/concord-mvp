package com.concordmvp.users;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Rejects an oversized avatar upload by its {@code Content-Length} header, before Spring/Tomcat
 * ever buffers the multipart body — the global {@code spring.servlet.multipart.max-file-size}
 * (150 MB, sized for message attachments) would otherwise let a request far exceeding the 5 MB
 * avatar limit get fully parsed onto disk before {@link AvatarStorageService#store} ever gets a
 * chance to reject it (security audit, Baixa finding).
 *
 * <p>{@code Content-Length} covers the whole multipart body (boundaries, headers, the file
 * itself), not just the file payload, so this is intentionally a coarse, early filter —
 * {@link AvatarStorageService}'s own check against the actual file size remains the precise,
 * authoritative one. A request without a {@code Content-Length} header (e.g. chunked transfer)
 * is let through unchanged; it still hits the global 150 MB cap and then the service-level
 * check, exactly as before this filter existed.
 */
@Component
public class AvatarUploadSizeFilter extends OncePerRequestFilter {

    private static final String AVATAR_UPLOAD_PATH = "/api/v1/users/me/avatar";

    private final long maxSize;

    public AvatarUploadSizeFilter(@Value("${app.uploads.avatar-max-size:5242880}") long maxSize) {
        this.maxSize = maxSize;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        if ("PUT".equalsIgnoreCase(request.getMethod())
                && AVATAR_UPLOAD_PATH.equals(request.getRequestURI())
                && request.getContentLengthLong() > maxSize) {
            response.sendError(HttpStatus.PAYLOAD_TOO_LARGE.value(), "Avatar exceeds the 5 MB limit");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
