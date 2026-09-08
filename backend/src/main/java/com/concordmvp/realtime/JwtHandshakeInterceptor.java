package com.concordmvp.realtime;

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
import java.util.Optional;
import java.util.UUID;

/**
 * Authenticates the WebSocket handshake. Browsers cannot set custom headers on a WebSocket
 * handshake request, so a short-lived, single-use ticket travels as a query parameter instead:
 * {@code wss://.../ws?token=<ticket>}. The ticket is minted by {@link RealtimeController} from
 * the caller's regular (long-lived) JWT and spent here via {@link WsTicketService} — the JWT
 * itself never appears in the WS URL, so it can't leak through DevTools, browser history, or
 * proxy logs the way a raw token in a URL would.
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

    private final WsTicketService wsTicketService;

    public JwtHandshakeInterceptor(WsTicketService wsTicketService) {
        this.wsTicketService = wsTicketService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        String ticket = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst("token");

        if (ticket == null || ticket.isBlank()) {
            log.warn("Rejecting WebSocket handshake: missing token query parameter");
            reject(response);
            return false;
        }

        Optional<UUID> userId = wsTicketService.consume(ticket);
        if (userId.isEmpty()) {
            log.warn("Rejecting WebSocket handshake: invalid or expired ticket");
            reject(response);
            return false;
        }

        attributes.put(USER_ID_ATTRIBUTE, userId.get());
        return true;
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
