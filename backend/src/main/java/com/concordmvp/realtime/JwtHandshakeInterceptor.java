package com.concordmvp.realtime;

import com.concordmvp.auth.JwtService;
import com.concordmvp.common.exception.UnauthorizedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;
import java.util.UUID;

/**
 * Authenticates the WebSocket handshake. Browsers cannot set custom headers on a WebSocket
 * handshake request, so the JWT travels as a query parameter instead:
 * {@code wss://.../ws?token=<jwt>}.
 *
 * <p>This is the ONLY place that authenticates {@code /ws} — the header-based
 * {@link com.concordmvp.auth.JwtAuthFilter} does not apply here (see
 * {@link com.concordmvp.config.SecurityConfig}, which permits {@code /ws} through the security
 * filter chain so the handshake request reaches this interceptor).
 */
@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    public static final String USER_ID_ATTRIBUTE = "userId";

    private final JwtService jwtService;

    public JwtHandshakeInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        String token = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst("token");

        if (token == null || token.isBlank()) {
            log.warn("Rejecting WebSocket handshake: missing token query parameter");
            reject(response);
            return false;
        }

        try {
            UUID userId = jwtService.parseUserId(token);
            attributes.put(USER_ID_ATTRIBUTE, userId);
            return true;
        } catch (UnauthorizedException e) {
            log.warn("Rejecting WebSocket handshake: invalid token");
            reject(response);
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        // No-op.
    }

    private void reject(ServerHttpResponse response) {
        if (response instanceof ServletServerHttpResponse) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
        }
    }
}
