package com.concordmvp.realtime;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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

    /**
     * Characterizes a race that previously existed between {@code register} (a two-step
     * computeIfAbsent + add) and {@code unregister}'s atomic computeIfPresent: if a user's last
     * session is unregistered (e.g. an old tab closing) at the same moment a new session for
     * that same user is registered (e.g. a page refresh), the new session could be added to a
     * Set instance that had just been detached from the map, silently losing the registration.
     * Both methods must now be atomic with respect to each other.
     */
    @Test
    void concurrentRegisterAndUnregister_neverLosesTheNewRegistration() throws InterruptedException {
        int iterations = 5_000;
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            for (int i = 0; i < iterations; i++) {
                UUID userId = UUID.randomUUID();
                WebSocketSession oldSession = mock(WebSocketSession.class);
                WebSocketSession newSession = mock(WebSocketSession.class);
                registry.register(userId, oldSession);

                CountDownLatch startLatch = new CountDownLatch(1);
                CountDownLatch doneLatch = new CountDownLatch(2);

                executor.submit(() -> {
                    await(startLatch);
                    registry.unregister(userId, oldSession);
                    doneLatch.countDown();
                });
                executor.submit(() -> {
                    await(startLatch);
                    registry.register(userId, newSession);
                    doneLatch.countDown();
                });

                startLatch.countDown();
                assertThat(doneLatch.await(5, TimeUnit.SECONDS)).isTrue();

                assertThat(registry.getSessions(userId))
                        .as("iteration %d: new session must survive a concurrent unregister of the old one", i)
                        .containsExactly(newSession);
            }
        } finally {
            executor.shutdownNow();
        }
    }

    private void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        }
    }
}
