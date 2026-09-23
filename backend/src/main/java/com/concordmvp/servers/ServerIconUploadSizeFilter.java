package com.concordmvp.servers;

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
import java.util.regex.Pattern;

/**
 * Same rationale as {@code com.concordmvp.users.AvatarUploadSizeFilter}: rejects an oversized
 * server-icon upload by its {@code Content-Length} header, before the global 150 MB multipart cap
 * (sized for message attachments) lets a request far exceeding the 5 MB icon limit buffer onto
 * disk before {@link ServerIconStorageService#store} ever gets a chance to reject it.
 * {@link ServerIconStorageService}'s own check against the actual file size remains authoritative.
 */
@Component
public class ServerIconUploadSizeFilter extends OncePerRequestFilter {

    private static final Pattern ICON_UPLOAD_PATH = Pattern.compile("^/api/v1/servers/[^/]+/icon$");

    private final long maxSize;

    public ServerIconUploadSizeFilter(@Value("${app.uploads.server-icon-max-size:5242880}") long maxSize) {
        this.maxSize = maxSize;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        if ("PUT".equalsIgnoreCase(request.getMethod())
                && ICON_UPLOAD_PATH.matcher(request.getRequestURI()).matches()
                && request.getContentLengthLong() > maxSize) {
            response.sendError(HttpStatus.PAYLOAD_TOO_LARGE.value(), "Server icon exceeds the 5 MB limit");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
