package com.concordmvp.realtime;

import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.media.VoicePresenceService;
import com.concordmvp.messages.MessageService;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatWebSocketHandlerTest {

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    @Mock
    private MessageService messageService;

    @Mock
    private VoicePresenceService voicePresenceService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ChatWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new ChatWebSocketHandler(sessionRegistry, objectMapper, messageService, voicePresenceService);
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
    void afterConnectionClosed_userHasNoRemainingSessions_removesVoicePresence() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);
        when(sessionRegistry.getSessions(userId)).thenReturn(Set.of());

        handler.afterConnectionClosed(session, CloseStatus.NORMAL);

        verify(voicePresenceService).removePresence(userId);
    }

    @Test
    void afterConnectionClosed_userHasAnotherOpenSession_doesNotRemoveVoicePresence() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);
        WebSocketSession otherSession = mock(WebSocketSession.class);
        when(sessionRegistry.getSessions(userId)).thenReturn(Set.of(otherSession));

        handler.afterConnectionClosed(session, CloseStatus.NORMAL);

        verify(voicePresenceService, never()).removePresence(any());
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

    @Test
    void handleTextMessage_messageCreate_valid_callsMessageService_andSendsNothingToSender() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);

        handler.handleMessage(session, new TextMessage(
                "{\"type\":\"MESSAGE_CREATE\",\"payload\":{\"channelId\":\"" + channelId + "\",\"content\":\"hi\"}}"));

        verify(messageService).sendMessage(eq(channelId), eq("hi"), eq(userId));
        verify(session, never()).sendMessage(any());
    }

    @Test
    void handleTextMessage_messageCreate_serviceThrows_sendsErrorFrameToSendingSessionOnly() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);
        when(messageService.sendMessage(eq(channelId), eq("hi"), eq(userId)))
                .thenThrow(new ForbiddenException("Not a member of this server"));

        handler.handleMessage(session, new TextMessage(
                "{\"type\":\"MESSAGE_CREATE\",\"payload\":{\"channelId\":\"" + channelId + "\",\"content\":\"hi\"}}"));

        WsEvent event = capturedEvent(session);
        assertThat(event.type()).isEqualTo(WsEventType.ERROR);
        JsonNode payload = objectMapper.valueToTree(event.payload());
        assertThat(payload.get("message").asText()).isEqualTo("Not a member of this server");
        verifyNoMoreInteractions(sessionRegistry);
    }

    @Test
    void handleTextMessage_voicePresenceUpdate_valid_callsServiceWithParsedFields() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);

        handler.handleMessage(session, new TextMessage(
                "{\"type\":\"VOICE_PRESENCE_UPDATE\",\"payload\":{"
                        + "\"channelId\":\"" + channelId + "\","
                        + "\"muted\":true,\"cameraOn\":false,\"screenSharing\":true,\"speaking\":false}}"));

        verify(voicePresenceService).updatePresence(channelId, userId, true, false, true, false);
        verify(session, never()).sendMessage(any());
    }

    @Test
    void handleTextMessage_voicePresenceUpdate_serviceThrows_sendsErrorFrameToSendingSessionOnly() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);
        doThrow(new ForbiddenException("Not a member of this server"))
                .when(voicePresenceService)
                .updatePresence(eq(channelId), eq(userId), anyBoolean(), anyBoolean(), anyBoolean(), anyBoolean());

        handler.handleMessage(session, new TextMessage(
                "{\"type\":\"VOICE_PRESENCE_UPDATE\",\"payload\":{"
                        + "\"channelId\":\"" + channelId + "\","
                        + "\"muted\":false,\"cameraOn\":false,\"screenSharing\":false,\"speaking\":false}}"));

        WsEvent event = capturedEvent(session);
        assertThat(event.type()).isEqualTo(WsEventType.ERROR);
    }

    @Test
    void handleTextMessage_voicePresenceLeave_callsRemovePresenceForSender() throws Exception {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = sessionWithUserId(userId);

        handler.handleMessage(session, new TextMessage("{\"type\":\"VOICE_PRESENCE_LEAVE\",\"payload\":{}}"));

        verify(voicePresenceService).removePresence(userId);
        verify(session, never()).sendMessage(any());
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
