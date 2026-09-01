package com.concordmvp.realtime;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory registry mapping a user id to their live WebSocket session(s) — a user can have
 * multiple sessions open at once (e.g. multiple browser tabs). Lives entirely in backend
 * memory: no Redis, no persistence. See docs/DECISIONS.md D3 — the app runs as a single
 * instance on a single VM, so in-memory state is deliberately preferred over adding
 * infrastructure.
 */
@Component
public class WebSocketSessionRegistry {

    private final ConcurrentHashMap<UUID, Set<WebSocketSession>> sessionsByUserId = new ConcurrentHashMap<>();

    public void register(UUID userId, WebSocketSession session) {
        // Atomic compute (rather than computeIfAbsent + separate add) so this can never race
        // with unregister()'s atomic computeIfPresent — otherwise a concurrent unregister of
        // the user's last session could detach the set from the map between this method's
        // lookup and its add(), silently dropping the new session.
        sessionsByUserId.compute(userId, (id, sessions) -> {
            Set<WebSocketSession> target = sessions == null ? ConcurrentHashMap.newKeySet() : sessions;
            target.add(session);
            return target;
        });
    }

    public void unregister(UUID userId, WebSocketSession session) {
        sessionsByUserId.computeIfPresent(userId, (id, sessions) -> {
            sessions.remove(session);
            return sessions.isEmpty() ? null : sessions;
        });
    }

    /**
     * Returns the user's live sessions, or an empty set (never {@code null}) if they have none.
     */
    public Set<WebSocketSession> getSessions(UUID userId) {
        Set<WebSocketSession> sessions = sessionsByUserId.get(userId);
        return sessions == null ? Collections.emptySet() : sessions;
    }
}
