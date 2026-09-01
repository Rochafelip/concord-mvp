package com.concordmvp.realtime;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class WebSocketSessionRegistryTest {

    private final WebSocketSessionRegistry registry = new WebSocketSessionRegistry();

    @Test
    void getSessions_returnsEmptySet_forUnknownUser() {
        assertThat(registry.getSessions(UUID.randomUUID())).isEmpty();
    }

    @Test
    void register_addsSession_retrievableByGetSessions() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = mock(WebSocketSession.class);

        registry.register(userId, session);

        assertThat(registry.getSessions(userId)).containsExactly(session);
    }

    @Test
    void register_supportsMultipleSessionsForSameUser_multiTab() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session1 = mock(WebSocketSession.class);
        WebSocketSession session2 = mock(WebSocketSession.class);

        registry.register(userId, session1);
        registry.register(userId, session2);

        assertThat(registry.getSessions(userId)).containsExactlyInAnyOrder(session1, session2);
    }

    @Test
    void unregister_removesOnlyTheGivenSession_whenOtherSessionsRemain() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session1 = mock(WebSocketSession.class);
        WebSocketSession session2 = mock(WebSocketSession.class);
        registry.register(userId, session1);
        registry.register(userId, session2);

        registry.unregister(userId, session1);

        assertThat(registry.getSessions(userId)).containsExactly(session2);
    }

    @Test
    void unregister_removesMapEntryEntirely_whenLastSessionRemoved() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = mock(WebSocketSession.class);
        registry.register(userId, session);

        registry.unregister(userId, session);

        Set<WebSocketSession> sessions = registry.getSessions(userId);
        assertThat(sessions).isEmpty();
    }

    @Test
    void unregister_onUnknownUser_doesNotThrow() {
        UUID userId = UUID.randomUUID();
        WebSocketSession session = mock(WebSocketSession.class);

        registry.unregister(userId, session);

        assertThat(registry.getSessions(userId)).isEmpty();
    }

    @Test
    void sessionsForDifferentUsers_areIndependent() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        WebSocketSession sessionA = mock(WebSocketSession.class);
        WebSocketSession sessionB = mock(WebSocketSession.class);

        registry.register(userA, sessionA);
        registry.register(userB, sessionB);
        registry.unregister(userA, sessionA);

        assertThat(registry.getSessions(userA)).isEmpty();
        assertThat(registry.getSessions(userB)).containsExactly(sessionB);
    }
}
