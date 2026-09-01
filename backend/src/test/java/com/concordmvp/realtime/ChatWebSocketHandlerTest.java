package com.concordmvp.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatWebSocketHandlerTest {

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ChatWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new ChatWebSocketHandler(sessionRegistry, objectMapper);
    }

    @Test
    void afterConnectionEstablished_registersSessionUnderHandshakeUserId() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);

        handler.afterConnectionEstablished(session);

        verify(sessionRegistry).register(userId, session);
    }

    @Test
    void afterConnectionClosed_unregistersSessionUnderHandshakeUserId() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);

        handler.afterConnectionClosed(session, CloseStatus.NORMAL);

        verify(sessionRegistry).unregister(userId, session);
    }

    @Test
    void handleTextMessage_malformedJson_sendsErrorFrameToSender_withoutThrowing() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);

        handler.handleMessage(session, new TextMessage("not-json-at-all"));

        WsEvent event = capturedEvent(session);
        assertThat(event.type()).isEqualTo(WsEventType.ERROR);
    }

    @Test
    void handleTextMessage_unrecognizedType_sendsErrorFrame_withTypeNameInMessage() throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);

        handler.handleMessage(session, new TextMessage("{\"type\":\"SOME_BOGUS_TYPE\",\"payload\":{}}"));

        WsEvent event = capturedEvent(session);
        assertThat(event.type()).isEqualTo(WsEventType.ERROR);

        JsonNode payload = objectMapper.valueToTree(event.payload());
        assertThat(payload.get("message").asText()).contains("SOME_BOGUS_TYPE");
    }

    private WebSocketSession sessionWithUserId(UUID userId) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getAttributes()).thenReturn(Map.of(JwtHandshakeInterceptor.USER_ID_ATTRIBUTE, userId));
        return session;
    }

    private WsEvent capturedEvent(WebSocketSession session) throws IOException {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());
        return objectMapper.readValue(captor.getValue().getPayload(), WsEvent.class);
    }
}
