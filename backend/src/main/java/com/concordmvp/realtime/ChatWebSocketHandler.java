package com.concordmvp.realtime;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.MessageService;
import com.concordmvp.messages.dto.SendMessageRequest;
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
 * <p>{@code MESSAGE_CREATE} is the only inbound type this app needs (docs/ARCHITECTURE.md §18).
 * It's handled by deserializing the frame's {@code payload} into a {@link SendMessageRequest} and
 * delegating to {@link MessageService#sendMessage}, which does its own broadcast (including back
 * to the sender) — so the success path here sends nothing further. This gives {@code realtime}
 * and {@code messages} a deliberate two-way relationship (this handler calls into
 * {@code MessageService}; {@code MessageService} calls back into
 * {@link RealtimeEventPublisher} to broadcast) which is the correct shape for this app, not
 * something to abstract away.
 */
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);

    private final WebSocketSessionRegistry sessionRegistry;
    private final ObjectMapper objectMapper;
    private final MessageService messageService;

    public ChatWebSocketHandler(WebSocketSessionRegistry sessionRegistry, ObjectMapper objectMapper,
                                 MessageService messageService) {
        this.sessionRegistry = sessionRegistry;
        this.objectMapper = objectMapper;
        this.messageService = messageService;
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
                case "MESSAGE_CREATE" -> handleMessageCreate(session, root.get("payload"));
                default -> sendError(session, "Unsupported message type: " + type);
            }
        } catch (IOException e) {
            log.warn("Received malformed WebSocket message from session {}", session.getId(), e);
            sendError(session, "Malformed message");
        }
    }

    private void handleMessageCreate(WebSocketSession session, JsonNode payloadNode) {
        try {
            SendMessageRequest request = objectMapper.treeToValue(payloadNode, SendMessageRequest.class);
            UUID userId = userId(session);
            messageService.sendMessage(request.channelId(), request.content(), userId);
            // No ack: MessageService.sendMessage already broadcasts MESSAGE_CREATE to every
            // server member, including the sender.
        } catch (ResourceNotFoundException | ForbiddenException | BadRequestException e) {
            sendError(session, e.getMessage());
        } catch (Exception e) {
            log.warn("Failed to handle MESSAGE_CREATE from session {}", session.getId(), e);
            sendError(session, "Failed to send message");
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
