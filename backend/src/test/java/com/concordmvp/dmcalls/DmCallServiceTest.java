package com.concordmvp.dmcalls;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ConflictException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.common.exception.TooManyRequestsException;
import com.concordmvp.dmcalls.dto.CallInvitePayload;
import com.concordmvp.dmcalls.dto.CallResolvedPayload;
import com.concordmvp.friends.Friendship;
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
import com.concordmvp.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DmCallServiceTest {

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    @Mock
    private MediaService mediaService;

    @Mock
    private VoicePresenceService voicePresenceService;

    private DmCallService dmCallService;

    @BeforeEach
    void setUp() {
        dmCallService = new DmCallService(friendshipRepository, userRepository, sessionRegistry,
                realtimeEventPublisher, mediaService, voicePresenceService);
        // Defaults so a test only has to override what it actually cares about: friends, online,
        // nobody busy.
        lenient().when(sessionRegistry.isOnline(org.mockito.ArgumentMatchers.any())).thenReturn(true);
        lenient().when(voicePresenceService.isInVoice(org.mockito.ArgumentMatchers.any())).thenReturn(false);
    }

    private User user(UUID id, String displayName) {
        User user = new User();
        user.setId(id);
        user.setUsername(displayName.toLowerCase());
        user.setDisplayName(displayName);
        user.setEmail(displayName.toLowerCase() + "@example.com");
        user.setPasswordHash("hash");
        return user;
    }

    private void stubAcceptedFriendship(UUID a, UUID b) {
        Friendship friendship = new Friendship();
        friendship.setId(UUID.randomUUID());
        friendship.setRequesterId(a);
        friendship.setAddresseeId(b);
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        when(friendshipRepository.findByPair(a, b)).thenReturn(Optional.of(friendship));
    }

    // --- invite ---

    @Test
    void invite_self_throwsBadRequest() {
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() -> dmCallService.invite(userId, userId)).isInstanceOf(BadRequestException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void invite_notFriends_throwsForbidden() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        when(friendshipRepository.findByPair(callerId, calleeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dmCallService.invite(callerId, calleeId)).isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void invite_pendingFriendship_throwsForbidden() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        Friendship pending = new Friendship();
        pending.setRequesterId(callerId);
        pending.setAddresseeId(calleeId);
        pending.setStatus(FriendshipStatus.PENDING);
        when(friendshipRepository.findByPair(callerId, calleeId)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> dmCallService.invite(callerId, calleeId)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void invite_calleeOffline_throwsConflict() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(sessionRegistry.isOnline(calleeId)).thenReturn(false);

        assertThatThrownBy(() -> dmCallService.invite(callerId, calleeId)).isInstanceOf(ConflictException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void invite_callerAlreadyInVoiceChannel_throwsConflict() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(voicePresenceService.isInVoice(callerId)).thenReturn(true);

        assertThatThrownBy(() -> dmCallService.invite(callerId, calleeId)).isInstanceOf(ConflictException.class);
    }

    @Test
    void invite_calleeAlreadyInVoiceChannel_throwsConflict() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(voicePresenceService.isInVoice(calleeId)).thenReturn(true);

        assertThatThrownBy(() -> dmCallService.invite(callerId, calleeId)).isInstanceOf(ConflictException.class);
    }

    @Test
    void invite_calleeAlreadyInAnotherDmCall_throwsConflict() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        UUID thirdParty = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        stubAcceptedFriendship(calleeId, thirdParty);
        when(userRepository.findById(calleeId)).thenReturn(Optional.of(user(calleeId, "Bob")));
        dmCallService.accept(dmCallService.invite(calleeId, thirdParty), thirdParty);

        assertThatThrownBy(() -> dmCallService.invite(callerId, calleeId)).isInstanceOf(ConflictException.class);
    }

    @Test
    void invite_rateLimited_throwsTooManyRequests() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));

        dmCallService.invite(callerId, calleeId);
        dmCallService.invite(callerId, calleeId);
        dmCallService.invite(callerId, calleeId);

        assertThatThrownBy(() -> dmCallService.invite(callerId, calleeId)).isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void invite_ratelimitIsPerCallerCalleePair_doesNotThrottleCallingADifferentFriend() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        UUID anotherFriendId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        stubAcceptedFriendship(callerId, anotherFriendId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));

        dmCallService.invite(callerId, calleeId);
        dmCallService.invite(callerId, calleeId);
        dmCallService.invite(callerId, calleeId);

        assertThatCodeDoesNotThrow(() -> dmCallService.invite(callerId, anotherFriendId));
    }

    private void assertThatCodeDoesNotThrow(Runnable runnable) {
        org.assertj.core.api.Assertions.assertThatCode(runnable::run).doesNotThrowAnyException();
    }

    @Test
    void invite_valid_broadcastsCallInviteToCalleeOnly() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));

        UUID callId = dmCallService.invite(callerId, calleeId);

        assertThat(callId).isNotNull();
        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(calleeId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.CALL_INVITE);
        CallInvitePayload payload = (CallInvitePayload) eventCaptor.getValue().payload();
        assertThat(payload.callId()).isEqualTo(callId);
        assertThat(payload.caller().id()).isEqualTo(callerId);
        assertThat(payload.caller().displayName()).isEqualTo("Alice");
    }

    // --- accept ---

    @Test
    void accept_unknownCallId_throwsResourceNotFound() {
        assertThatThrownBy(() -> dmCallService.accept(UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void accept_byWrongUser_throwsForbidden() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        UUID impostor = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        assertThatThrownBy(() -> dmCallService.accept(callId, impostor)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void accept_valid_issuesTokenForCallee_andBroadcastsAcceptedToBoth() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);
        VoiceTokenResponse expectedToken = new VoiceTokenResponse("jwt", "wss://x", "room");
        String expectedRoomName = roomNameFor(callerId, calleeId);
        when(mediaService.issueDmCallToken(calleeId, expectedRoomName)).thenReturn(expectedToken);

        VoiceTokenResponse result = dmCallService.accept(callId, calleeId);

        assertThat(result).isEqualTo(expectedToken);
        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(callerId, calleeId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.CALL_RESOLVED);
        CallResolvedPayload payload = (CallResolvedPayload) eventCaptor.getValue().payload();
        assertThat(payload.callId()).isEqualTo(callId);
        assertThat(payload.outcome()).isEqualTo(CallOutcome.ACCEPTED);
        assertThat(payload.roomName()).isEqualTo(expectedRoomName);
    }

    @Test
    void accept_valid_makesIsInCallTrueForBothParticipants() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        dmCallService.accept(callId, calleeId);

        assertThat(dmCallService.isInCall(callerId)).isTrue();
        assertThat(dmCallService.isInCall(calleeId)).isTrue();
    }

    @Test
    void accept_alreadyAccepted_secondAcceptThrowsResourceNotFound() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);
        dmCallService.accept(callId, calleeId);

        assertThatThrownBy(() -> dmCallService.accept(callId, calleeId)).isInstanceOf(ResourceNotFoundException.class);
    }

    // --- decline ---

    @Test
    void decline_unknownCallId_throwsResourceNotFound() {
        assertThatThrownBy(() -> dmCallService.decline(UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void decline_byWrongUser_throwsForbidden() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        assertThatThrownBy(() -> dmCallService.decline(callId, callerId)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void decline_valid_broadcastsDeclinedToCallerOnly() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        dmCallService.decline(callId, calleeId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        // First broadcast was the invite itself; capture the second (decline) call.
        verify(realtimeEventPublisher, org.mockito.Mockito.times(2))
                .broadcast(org.mockito.ArgumentMatchers.any(), eventCaptor.capture());
        WsEvent declineEvent = eventCaptor.getAllValues().get(1);
        assertThat(declineEvent.type()).isEqualTo(WsEventType.CALL_RESOLVED);
        CallResolvedPayload payload = (CallResolvedPayload) declineEvent.payload();
        assertThat(payload.outcome()).isEqualTo(CallOutcome.DECLINED);
        assertThat(payload.roomName()).isNull();
        verify(realtimeEventPublisher).broadcast(Set.of(callerId), declineEvent);
    }

    @Test
    void decline_thenAccept_throwsResourceNotFound() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);
        dmCallService.decline(callId, calleeId);

        assertThatThrownBy(() -> dmCallService.accept(callId, calleeId)).isInstanceOf(ResourceNotFoundException.class);
    }

    // --- cancel ---

    @Test
    void cancel_unknownCallId_throwsResourceNotFound() {
        assertThatThrownBy(() -> dmCallService.cancel(UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void cancel_byWrongUser_throwsForbidden() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        assertThatThrownBy(() -> dmCallService.cancel(callId, calleeId)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cancel_valid_broadcastsCancelledToCalleeOnly() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        dmCallService.cancel(callId, callerId);

        // Both the invite and the cancel broadcast to Set.of(calleeId); capture the second.
        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, org.mockito.Mockito.times(2))
                .broadcast(eq(Set.of(calleeId)), eventCaptor.capture());
        CallResolvedPayload payload = (CallResolvedPayload) eventCaptor.getAllValues().get(1).payload();
        assertThat(payload.outcome()).isEqualTo(CallOutcome.CANCELLED);
    }

    // --- token ---

    @Test
    void token_callNeverAccepted_throwsResourceNotFound() {
        assertThatThrownBy(() -> dmCallService.token(UUID.randomUUID(), UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void token_requesterNotInTheCall_throwsResourceNotFound() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        UUID outsider = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);
        dmCallService.accept(callId, calleeId);

        assertThatThrownBy(() -> dmCallService.token(callId, outsider)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void token_participantOfAcceptedCall_issuesTokenForThatRoom() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);
        dmCallService.accept(callId, calleeId);
        String expectedRoomName = roomNameFor(callerId, calleeId);
        VoiceTokenResponse expectedToken = new VoiceTokenResponse("jwt", "wss://x", expectedRoomName);
        when(mediaService.issueDmCallToken(callerId, expectedRoomName)).thenReturn(expectedToken);

        VoiceTokenResponse result = dmCallService.token(callId, callerId);

        assertThat(result).isEqualTo(expectedToken);
    }

    // --- isInCall ---

    @Test
    void isInCall_noActiveCall_returnsFalse() {
        assertThat(dmCallService.isInCall(UUID.randomUUID())).isFalse();
    }

    // --- handleDisconnect ---

    @Test
    void handleDisconnect_callerWithPendingOutgoingInvite_cancelsIt_andNotifiesCallee() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        dmCallService.handleDisconnect(callerId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, org.mockito.Mockito.times(2))
                .broadcast(org.mockito.ArgumentMatchers.any(), eventCaptor.capture());
        WsEvent disconnectEvent = eventCaptor.getAllValues().get(1);
        assertThat(disconnectEvent.type()).isEqualTo(WsEventType.CALL_RESOLVED);
        assertThat(((CallResolvedPayload) disconnectEvent.payload()).outcome()).isEqualTo(CallOutcome.CANCELLED);
        verify(realtimeEventPublisher).broadcast(Set.of(calleeId), disconnectEvent);
        // The pending invite is gone: accepting it now fails.
        assertThatThrownBy(() -> dmCallService.accept(callId, calleeId)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void handleDisconnect_calleeWithPendingIncomingInvite_notifiesCaller() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        dmCallService.invite(callerId, calleeId);

        dmCallService.handleDisconnect(calleeId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, org.mockito.Mockito.times(2))
                .broadcast(org.mockito.ArgumentMatchers.any(), eventCaptor.capture());
        WsEvent disconnectEvent = eventCaptor.getAllValues().get(1);
        verify(realtimeEventPublisher).broadcast(Set.of(callerId), disconnectEvent);
    }

    @Test
    void handleDisconnect_participantOfAnActiveCall_endsIt() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);
        dmCallService.accept(callId, calleeId);

        dmCallService.handleDisconnect(callerId);

        assertThat(dmCallService.isInCall(callerId)).isFalse();
        assertThat(dmCallService.isInCall(calleeId)).isFalse();
    }

    @Test
    void handleDisconnect_userWithNothingPending_isNoOp() {
        UUID userId = UUID.randomUUID();

        dmCallService.handleDisconnect(userId);

        verify(realtimeEventPublisher, never()).broadcast(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    // --- room naming ---

    @Test
    void roomName_isDeterministic_regardlessOfWhoInvitedWhom() {
        UUID callerId = UUID.randomUUID();
        UUID calleeId = UUID.randomUUID();
        stubAcceptedFriendship(callerId, calleeId);
        when(userRepository.findById(callerId)).thenReturn(Optional.of(user(callerId, "Alice")));
        UUID callId = dmCallService.invite(callerId, calleeId);

        dmCallService.accept(callId, calleeId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(callerId, calleeId)), eventCaptor.capture());
        String roomName = ((CallResolvedPayload) eventCaptor.getValue().payload()).roomName();
        assertThat(roomName).isEqualTo(roomNameFor(callerId, calleeId));
        assertThat(roomName).isEqualTo(roomNameFor(calleeId, callerId));
    }

    private String roomNameFor(UUID a, UUID b) {
        UUID low = a.compareTo(b) < 0 ? a : b;
        UUID high = a.compareTo(b) < 0 ? b : a;
        return "dm-call-" + low + "-" + high;
    }
}
