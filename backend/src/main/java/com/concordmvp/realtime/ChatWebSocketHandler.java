package com.concordmvp.realtime;

import com.concordmvp.realtime.dto.ErrorPayload;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.UUID;

/**
 * The {@code /ws} endpoint handler. Registers/unregisters sessions with the
 * {@link WebSocketSessionRegistry} and dispatches inbound frames by their {@code type} field.
 *
 * <p>No inbound event type is handled yet in this task — {@code MESSAGE_CREATE} (the only
 * inbound type this app needs, per docs/ARCHITECTURE.md §18) is wired in a later task once the
 * {@code messages} module exists. Every type is currently reported back to the sender as an
 * {@link WsEventType#ERROR} frame; adding a real case is a one-branch addition to the switch in
 * {@link #handleTextMessage}.
 */
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final WebSocketSessionRegistry sessionRegistry;
    private final ObjectMapper objectMapper;

    public ChatWebSocketHandler(WebSocketSessionRegistry sessionRegistry, ObjectMapper objectMapper) {
        this.sessionRegistry = sessionRegistry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        sessionRegistry.register(userId(session), session);
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        sessionRegistry.unregister(userId(session), session);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        String type = null;
        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            JsonNode typeNode = root.get("type");
            type = typeNode == null ? null : typeNode.asText();

            switch (type == null ? "" : type) {
                // MESSAGE_CREATE will be added here in a later task, once the `messages`
                // module exists, deserializing root.get("payload") into its own DTO.
                default -> sendError(session, "Unsupported message type: " + type);
            }
        } catch (IOException e) {
            log.warn("Received malformed WebSocket message from session {}", session.getId(), e);
            sendError(session, "Malformed message");
        }
    }

    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        log.warn("Transport error on WebSocket session {}", session.getId(), exception);
    }

    private void sendError(WebSocketSession session, String errorMessage) {
        try {
            String json = objectMapper.writeValueAsString(new WsEvent(WsEventType.ERROR, new ErrorPayload(errorMessage)));
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.warn("Failed to send ERROR frame to session {}", session.getId(), e);
        }
    }

    private UUID userId(WebSocketSession session) {
        return (UUID) session.getAttributes().get(JwtHandshakeInterceptor.USER_ID_ATTRIBUTE);
    }
}
