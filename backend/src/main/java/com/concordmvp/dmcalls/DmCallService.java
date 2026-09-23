package com.concordmvp.dmcalls;

import com.concordmvp.common.RateLimiter;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ConflictException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.common.exception.TooManyRequestsException;
import com.concordmvp.dmcalls.dto.CallInvitePayload;
import com.concordmvp.dmcalls.dto.CallResolvedPayload;
import com.concordmvp.friends.FriendshipRepository;
import com.concordmvp.friends.FriendshipStatus;
import com.concordmvp.media.MediaService;
import com.concordmvp.media.VoicePresenceService;
import com.concordmvp.media.dto.VoiceTokenResponse;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WebSocketSessionRegistry;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.users.User;
import com.concordmvp.users.UserAvatarUrls;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.dto.UserSummaryResponse;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Orchestrates 1:1 voice/video calls between two friends — ring, accept, decline, cancel — and
 * the LiveKit room both sides join once accepted
 * (docs/superpowers/specs/2026-09-23-dm-call-design.md). Entirely in-memory, no persistence: a
 * missed call simply disappears, the same way a real phone call would.
 *
 * <p>Deliberately a separate map from {@link VoicePresenceService}'s presence tracking — that one
 * carries per-participant mute/camera/speaking state a 1:1 call has no use for, and is broadcast
 * to a whole server's membership rather than exactly two people. The two services consult each
 * other only to enforce this app's "one call at a time" invariant across both call types: this
 * class calls {@link VoicePresenceService#isInVoice} directly, and {@code VoicePresenceService}
 * holds a {@code @Lazy} back-reference to this class to check {@link #isInCall} — same circular
 * pattern already used between {@code VoicePresenceService} and {@code WhistleService}.
 */
@Service
public class DmCallService {

    private static final Duration RING_TTL = Duration.ofSeconds(30);

    private record PendingCall(UUID callId, UUID callerId, UUID calleeId, Instant expiresAt) {
        boolean isExpired(Instant now) {
            return now.isAfter(expiresAt);
        }
    }

    private record ActiveCall(UUID callId, UUID userAId, UUID userBId, String roomName) {
        boolean involves(UUID userId) {
            return userAId.equals(userId) || userBId.equals(userId);
        }
    }

    private final ConcurrentHashMap<UUID, PendingCall> pendingById = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, ActiveCall> activeById = new ConcurrentHashMap<>();

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final WebSocketSessionRegistry sessionRegistry;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final MediaService mediaService;
    private final VoicePresenceService voicePresenceService;

    // Keyed by "callerId:calleeId", not just callerId — a caller spamming many different friends
    // shouldn't be throttled by attempts aimed at any one of them, but ringing the same friend
    // repeatedly should be.
    private final RateLimiter inviteRateLimiter =
            new RateLimiter(3, Duration.ofMinutes(1), 10, Duration.ofHours(1));

    public DmCallService(FriendshipRepository friendshipRepository, UserRepository userRepository,
                          WebSocketSessionRegistry sessionRegistry, RealtimeEventPublisher realtimeEventPublisher,
                          MediaService mediaService, VoicePresenceService voicePresenceService) {
        this.friendshipRepository = friendshipRepository;
        this.userRepository = userRepository;
        this.sessionRegistry = sessionRegistry;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.mediaService = mediaService;
        this.voicePresenceService = voicePresenceService;
    }

    public UUID invite(UUID callerId, UUID calleeId) {
        if (callerId.equals(calleeId)) {
            throw new BadRequestException("Você não pode ligar para si mesmo");
        }
        requireFriends(callerId, calleeId);

        if (!inviteRateLimiter.tryAcquire(callerId + ":" + calleeId, Instant.now())) {
            throw new TooManyRequestsException("Muitas tentativas de chamada. Tente novamente em instantes.");
        }
        if (!sessionRegistry.isOnline(calleeId)) {
            throw new ConflictException("Esse amigo está offline");
        }
        if (isBusy(callerId) || isBusy(calleeId)) {
            throw new ConflictException("Ocupado");
        }

        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + callerId));

        UUID callId = UUID.randomUUID();
        pendingById.put(callId, new PendingCall(callId, callerId, calleeId, Instant.now().plus(RING_TTL)));

        realtimeEventPublisher.broadcast(Set.of(calleeId),
                new WsEvent(WsEventType.CALL_INVITE, new CallInvitePayload(callId, toSummary(caller))));

        return callId;
    }

    public VoiceTokenResponse accept(UUID callId, UUID calleeId) {
        PendingCall pending = requirePending(callId);
        if (!pending.calleeId().equals(calleeId)) {
            throw new ForbiddenException("Somente quem recebeu a chamada pode aceitá-la");
        }
        pendingById.remove(callId);

        String roomName = roomName(pending.callerId(), pending.calleeId());
        activeById.put(callId, new ActiveCall(callId, pending.callerId(), pending.calleeId(), roomName));

        realtimeEventPublisher.broadcast(Set.of(pending.callerId(), pending.calleeId()),
                new WsEvent(WsEventType.CALL_RESOLVED,
                        new CallResolvedPayload(callId, CallOutcome.ACCEPTED, roomName)));

        return mediaService.issueDmCallToken(calleeId, roomName);
    }

    public void decline(UUID callId, UUID calleeId) {
        PendingCall pending = requirePending(callId);
        if (!pending.calleeId().equals(calleeId)) {
            throw new ForbiddenException("Somente quem recebeu a chamada pode recusá-la");
        }
        pendingById.remove(callId);

        realtimeEventPublisher.broadcast(Set.of(pending.callerId()),
                new WsEvent(WsEventType.CALL_RESOLVED,
                        new CallResolvedPayload(callId, CallOutcome.DECLINED, null)));
    }

    /** Also how a client-side 30s ring timeout is expressed — from the backend's perspective, an
     *  unanswered call ending is indistinguishable from the caller giving up on it. */
    public void cancel(UUID callId, UUID callerId) {
        PendingCall pending = requirePending(callId);
        if (!pending.callerId().equals(callerId)) {
            throw new ForbiddenException("Somente quem fez a chamada pode cancelá-la");
        }
        pendingById.remove(callId);

        realtimeEventPublisher.broadcast(Set.of(pending.calleeId()),
                new WsEvent(WsEventType.CALL_RESOLVED,
                        new CallResolvedPayload(callId, CallOutcome.CANCELLED, null)));
    }

    public VoiceTokenResponse token(UUID callId, UUID requesterId) {
        ActiveCall active = activeById.get(callId);
        if (active == null || !active.involves(requesterId)) {
            throw new ResourceNotFoundException("Call not found: " + callId);
        }
        return mediaService.issueDmCallToken(requesterId, active.roomName());
    }

    /** Whether {@code userId} is currently in an accepted 1:1 call — consulted by
     *  {@link VoicePresenceService} to keep "one call at a time" across both call types. */
    public boolean isInCall(UUID userId) {
        return activeById.values().stream().anyMatch(call -> call.involves(userId));
    }

    /**
     * Single cleanup funnel for "this user's last WebSocket session just closed" — mirrors
     * {@link VoicePresenceService#removePresence}. Ends any pending invite they were part of
     * (notifying the other side) and any active call they were in.
     */
    public void handleDisconnect(UUID userId) {
        pendingById.values().stream()
                .filter(call -> call.callerId().equals(userId) || call.calleeId().equals(userId))
                .map(PendingCall::callId)
                .toList()
                .forEach(callId -> {
                    PendingCall pending = pendingById.remove(callId);
                    if (pending == null) return;
                    UUID other = pending.callerId().equals(userId) ? pending.calleeId() : pending.callerId();
                    realtimeEventPublisher.broadcast(Set.of(other), new WsEvent(WsEventType.CALL_RESOLVED,
                            new CallResolvedPayload(callId, CallOutcome.CANCELLED, null)));
                });

        activeById.values().stream()
                .filter(call -> call.involves(userId))
                .map(ActiveCall::callId)
                .toList()
                .forEach(activeById::remove);
    }

    // ------------------------------------------------------------------ internals

    private boolean isBusy(UUID userId) {
        return isInCall(userId) || voicePresenceService.isInVoice(userId);
    }

    private PendingCall requirePending(UUID callId) {
        PendingCall pending = pendingById.get(callId);
        if (pending == null || pending.isExpired(Instant.now())) {
            pendingById.remove(callId);
            throw new ResourceNotFoundException("Call not found: " + callId);
        }
        return pending;
    }

    private void requireFriends(UUID userA, UUID userB) {
        friendshipRepository.findByPair(userA, userB)
                .filter(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                .orElseThrow(() -> new ForbiddenException("Vocês só podem ligar para amigos"));
    }

    private String roomName(UUID a, UUID b) {
        UUID low = a.compareTo(b) < 0 ? a : b;
        UUID high = a.compareTo(b) < 0 ? b : a;
        return "dm-call-" + low + "-" + high;
    }

    private UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getUsername(), user.getDisplayName(),
                UserAvatarUrls.url(user));
    }
}
