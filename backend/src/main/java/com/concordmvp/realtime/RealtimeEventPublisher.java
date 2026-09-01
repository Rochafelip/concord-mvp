package com.concordmvp.realtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

/**
 * Broadcasts {@link WsEvent}s to a caller-supplied set of recipient user ids.
 *
 * <p>Deliberately does NOT know how to look up server/channel membership itself — that would
 * create a dependency from {@code realtime} on the (not-yet-existing, at the time this class was
 * written) {@code servers}/{@code channels}/{@code messages} packages. Callers already have their
 * own recipient list (queried via their own repositories) and pass it in, keeping this package
 * fully decoupled from those domains.
 */
@Component
public class RealtimeEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventPublisher.class);

    private final WebSocketSessionRegistry sessionRegistry;
    private final ObjectMapper objectMapper;

    public RealtimeEventPublisher(WebSocketSessionRegistry sessionRegistry, ObjectMapper objectMapper) {
        this.sessionRegistry = sessionRegistry;
        this.objectMapper = objectMapper;
    }

    public void broadcast(Set<UUID> recipientUserIds, WsEvent event) {
        String json;
        try {
            json = objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize WsEvent {}; broadcast aborted", event.type(), e);
            return;
        }

        TextMessage message = new TextMessage(json);

        for (UUID recipientUserId : recipientUserIds) {
            for (WebSocketSession session : sessionRegistry.getSessions(recipientUserId)) {
                try {
                    session.sendMessage(message);
                } catch (IOException | IllegalStateException e) {
                    log.warn("Failed to send WsEvent {} to session {} of user {}",
                            event.type(), session.getId(), recipientUserId, e);
                }
            }
        }
    }
}
