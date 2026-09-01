package com.concordmvp.realtime;

import com.concordmvp.realtime.dto.ErrorPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RealtimeEventPublisherTest {

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    private RealtimeEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new RealtimeEventPublisher(sessionRegistry, new ObjectMapper());
    }

    @Test
    void broadcast_sendsSerializedEvent_toRecipientWithLiveSession() throws IOException {
        UUID recipient = UUID.randomUUID();
        WebSocketSession session = mock(WebSocketSession.class);
        when(sessionRegistry.getSessions(recipient)).thenReturn(Set.of(session));

        WsEvent event = new WsEvent(WsEventType.ERROR, new ErrorPayload("hello"));
        publisher.broadcast(Set.of(recipient), event);

        verify(session).sendMessage(any(TextMessage.class));
    }

    @Test
    void broadcast_toRecipientWithNoSessions_isNoOp() {
        UUID recipient = UUID.randomUUID();
        when(sessionRegistry.getSessions(recipient)).thenReturn(Set.of());

        WsEvent event = new WsEvent(WsEventType.ERROR, new ErrorPayload("hello"));

        publisher.broadcast(Set.of(recipient), event);
        // No exception; nothing to verify beyond "did not throw".
    }

    @Test
    void broadcast_emptyRecipientSet_doesNotTouchRegistry() {
        publisher.broadcast(Set.of(), new WsEvent(WsEventType.ERROR, new ErrorPayload("hello")));

        verifyNoInteractions(sessionRegistry);
    }

    @Test
    void broadcast_oneSessionFailure_doesNotPreventDeliveryToOthers() throws IOException {
        UUID recipient = UUID.randomUUID();
        WebSocketSession failingSession = mock(WebSocketSession.class);
        WebSocketSession healthySession = mock(WebSocketSession.class);
        doThrow(new IOException("boom")).when(failingSession).sendMessage(any(TextMessage.class));
        when(sessionRegistry.getSessions(recipient))
                .thenReturn(Set.of(failingSession, healthySession));

        publisher.broadcast(Set.of(recipient), new WsEvent(WsEventType.ERROR, new ErrorPayload("hello")));

        verify(healthySession).sendMessage(any(TextMessage.class));
    }

    @Test
    void broadcast_sendsToAllRecipients_independently() throws IOException {
        UUID recipientA = UUID.randomUUID();
        UUID recipientB = UUID.randomUUID();
        WebSocketSession sessionA = mock(WebSocketSession.class);
        WebSocketSession sessionB = mock(WebSocketSession.class);
        when(sessionRegistry.getSessions(recipientA)).thenReturn(Set.of(sessionA));
        when(sessionRegistry.getSessions(recipientB)).thenReturn(Set.of(sessionB));

        publisher.broadcast(Set.of(recipientA, recipientB), new WsEvent(WsEventType.ERROR, new ErrorPayload("hello")));

        verify(sessionA, times(1)).sendMessage(any(TextMessage.class));
        verify(sessionB, times(1)).sendMessage(any(TextMessage.class));
    }
}
