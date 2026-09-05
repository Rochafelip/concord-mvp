package com.concordmvp.config;

import com.concordmvp.realtime.ChatWebSocketHandler;
import com.concordmvp.realtime.JwtHandshakeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registers the {@code /ws} endpoint. Plain native WebSocket — no SockJS fallback — matching
 * the frontend's planned native {@code WebSocket} client.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;

    public WebSocketConfig(ChatWebSocketHandler chatWebSocketHandler, JwtHandshakeInterceptor jwtHandshakeInterceptor) {
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        // Spring rejects cross-origin WebSocket handshakes (403) by default, comparing the
        // browser's Origin header against the server's own perceived host/port — which never
        // matches when running behind a reverse proxy (nginx here), regardless of proxy header
        // configuration, since the backend container has no way to know what public host/port
        // it's reached through. Safe to allow any origin here specifically because /ws
        // authenticates via a JWT bearer token in the query string (JwtHandshakeInterceptor),
        // not cookies — there's no cross-site credential to ride along with a forged request.
        registry.addHandler(chatWebSocketHandler, "/ws")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOrigins("*");
    }
}
