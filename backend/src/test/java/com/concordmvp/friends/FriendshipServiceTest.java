package com.concordmvp.friends;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ConflictException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.friends.dto.FriendResponse;
import com.concordmvp.friends.dto.FriendUpdatePayload;
import com.concordmvp.friends.dto.PendingFriendRequestsResponse;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WebSocketSessionRegistry;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FriendshipServiceTest {

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    private FriendshipService friendshipService;

    @BeforeEach
    void setUp() {
        friendshipService = new FriendshipService(friendshipRepository, serverMemberRepository, userRepository,
                realtimeEventPublisher, sessionRegistry);
    }

    private User user(UUID id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setDisplayName(username);
        user.setEmail(username + "@example.com");
        user.setPasswordHash("hash");
        return user;
    }

    private ServerMember member(UUID serverId, UUID userId) {
        ServerMember member = new ServerMember();
        member.setId(UUID.randomUUID());
        member.setServerId(serverId);
        member.setUserId(userId);
        return member;
    }

    private Friendship friendship(UUID id, UUID requesterId, UUID addresseeId, FriendshipStatus status) {
        Friendship friendship = new Friendship();
        friendship.setId(id);
        friendship.setRequesterId(requesterId);
        friendship.setAddresseeId(addresseeId);
        friendship.setStatus(status);
        return friendship;
    }

    private void stubSharedServer(UUID userA, UUID userB) {
        UUID serverId = UUID.randomUUID();
        when(serverMemberRepository.findByUserIdOrderByJoinedAtAsc(userA)).thenReturn(List.of(member(serverId, userA)));
        when(serverMemberRepository.findByUserIdOrderByJoinedAtAsc(userB)).thenReturn(List.of(member(serverId, userB)));
    }

    // --- sendRequest ---

    @Test
    void sendRequest_self_throwsBadRequest() {
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() -> friendshipService.sendRequest(userId, userId))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(friendshipRepository, realtimeEventPublisher);
    }

    @Test
    void sendRequest_addresseeNotFound_throwsResourceNotFound() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        when(userRepository.findById(addresseeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> friendshipService.sendRequest(requesterId, addresseeId))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(friendshipRepository, realtimeEventPublisher);
    }

    @Test
    void sendRequest_noSharedServer_throwsForbidden() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        when(userRepository.findById(addresseeId)).thenReturn(Optional.of(user(addresseeId, "bob")));
        when(serverMemberRepository.findByUserIdOrderByJoinedAtAsc(requesterId))
                .thenReturn(List.of(member(UUID.randomUUID(), requesterId)));
        when(serverMemberRepository.findByUserIdOrderByJoinedAtAsc(addresseeId))
                .thenReturn(List.of(member(UUID.randomUUID(), addresseeId)));

        assertThatThrownBy(() -> friendshipService.sendRequest(requesterId, addresseeId))
                .isInstanceOf(ForbiddenException.class);

        verify(friendshipRepository, never()).save(any());
        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void sendRequest_alreadyFriends_throwsConflict() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        when(userRepository.findById(addresseeId)).thenReturn(Optional.of(user(addresseeId, "bob")));
        stubSharedServer(requesterId, addresseeId);
        when(friendshipRepository.findByPair(requesterId, addresseeId))
                .thenReturn(Optional.of(friendship(UUID.randomUUID(), requesterId, addresseeId, FriendshipStatus.ACCEPTED)));

        assertThatThrownBy(() -> friendshipService.sendRequest(requesterId, addresseeId))
                .isInstanceOf(ConflictException.class);

        verify(friendshipRepository, never()).save(any());
    }

    @Test
    void sendRequest_alreadyPending_throwsConflict() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        when(userRepository.findById(addresseeId)).thenReturn(Optional.of(user(addresseeId, "bob")));
        stubSharedServer(requesterId, addresseeId);
        when(friendshipRepository.findByPair(requesterId, addresseeId))
                .thenReturn(Optional.of(friendship(UUID.randomUUID(), requesterId, addresseeId, FriendshipStatus.PENDING)));

        assertThatThrownBy(() -> friendshipService.sendRequest(requesterId, addresseeId))
                .isInstanceOf(ConflictException.class);

        verify(friendshipRepository, never()).save(any());
    }

    @Test
    void sendRequest_valid_persistsPendingAndBroadcastsToBothUsers() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        when(userRepository.findById(addresseeId)).thenReturn(Optional.of(user(addresseeId, "bob")));
        stubSharedServer(requesterId, addresseeId);
        when(friendshipRepository.findByPair(requesterId, addresseeId)).thenReturn(Optional.empty());
        when(friendshipRepository.save(any(Friendship.class))).thenAnswer(inv -> inv.getArgument(0));

        friendshipService.sendRequest(requesterId, addresseeId);

        ArgumentCaptor<Friendship> captor = ArgumentCaptor.forClass(Friendship.class);
        verify(friendshipRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(FriendshipStatus.PENDING);
        assertThat(captor.getValue().getRequesterId()).isEqualTo(requesterId);
        assertThat(captor.getValue().getAddresseeId()).isEqualTo(addresseeId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(requesterId, addresseeId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.FRIEND_UPDATE);
        assertThat(eventCaptor.getValue().payload()).isEqualTo(new FriendUpdatePayload(requesterId, addresseeId));
    }

    // --- acceptRequest ---

    @Test
    void acceptRequest_notAddressee_throwsForbidden() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        Friendship pending = friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> friendshipService.acceptRequest(friendshipId, requesterId))
                .isInstanceOf(ForbiddenException.class);

        verify(friendshipRepository, never()).save(any());
    }

    @Test
    void acceptRequest_alreadyAccepted_throwsResourceNotFound() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        when(friendshipRepository.findById(friendshipId))
                .thenReturn(Optional.of(friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.ACCEPTED)));

        assertThatThrownBy(() -> friendshipService.acceptRequest(friendshipId, addresseeId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void acceptRequest_valid_setsAcceptedAndBroadcasts() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        Friendship pending = friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(pending));
        when(friendshipRepository.acceptIfPending(friendshipId)).thenReturn(1);

        friendshipService.acceptRequest(friendshipId, addresseeId);

        assertThat(pending.getStatus()).isEqualTo(FriendshipStatus.ACCEPTED);
        verify(friendshipRepository, never()).save(any());
        verify(realtimeEventPublisher).broadcast(eq(Set.of(requesterId, addresseeId)), any(WsEvent.class));
    }

    @Test
    void acceptRequest_losesRaceToAConcurrentAccept_throwsResourceNotFound_andDoesNotNotify() {
        // Both requests read the row as PENDING before either commits (e.g. a double-click or
        // two open tabs); acceptIfPending's WHERE clause is what actually decides the winner —
        // simulated here by the repository returning 0 rows affected for the loser.
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        Friendship pending = friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(pending));
        when(friendshipRepository.acceptIfPending(friendshipId)).thenReturn(0);

        assertThatThrownBy(() -> friendshipService.acceptRequest(friendshipId, addresseeId))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    // --- cancelOrDecline ---

    @Test
    void cancelOrDecline_notInvolved_throwsForbidden() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        UUID stranger = UUID.randomUUID();
        when(friendshipRepository.findById(friendshipId))
                .thenReturn(Optional.of(friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.PENDING)));

        assertThatThrownBy(() -> friendshipService.cancelOrDecline(friendshipId, stranger))
                .isInstanceOf(ForbiddenException.class);

        verify(friendshipRepository, never()).delete(any());
    }

    @Test
    void cancelOrDecline_byRequester_deletesAndBroadcasts() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        Friendship pending = friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(pending));

        friendshipService.cancelOrDecline(friendshipId, requesterId);

        verify(friendshipRepository).delete(pending);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(requesterId, addresseeId)), any(WsEvent.class));
    }

    @Test
    void cancelOrDecline_byAddressee_deletesAndBroadcasts() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        Friendship pending = friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.PENDING);
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(pending));

        friendshipService.cancelOrDecline(friendshipId, addresseeId);

        verify(friendshipRepository).delete(pending);
    }

    // --- removeFriend ---

    @Test
    void removeFriend_stillPending_throwsResourceNotFound() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        when(friendshipRepository.findById(friendshipId))
                .thenReturn(Optional.of(friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.PENDING)));

        assertThatThrownBy(() -> friendshipService.removeFriend(friendshipId, requesterId))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(friendshipRepository, never()).delete(any());
    }

    @Test
    void removeFriend_notInvolved_throwsForbidden() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        UUID stranger = UUID.randomUUID();
        when(friendshipRepository.findById(friendshipId))
                .thenReturn(Optional.of(friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.ACCEPTED)));

        assertThatThrownBy(() -> friendshipService.removeFriend(friendshipId, stranger))
                .isInstanceOf(ForbiddenException.class);

        verify(friendshipRepository, never()).delete(any());
    }

    @Test
    void removeFriend_valid_deletesAndBroadcasts() {
        UUID requesterId = UUID.randomUUID();
        UUID addresseeId = UUID.randomUUID();
        UUID friendshipId = UUID.randomUUID();
        Friendship accepted = friendship(friendshipId, requesterId, addresseeId, FriendshipStatus.ACCEPTED);
        when(friendshipRepository.findById(friendshipId)).thenReturn(Optional.of(accepted));

        friendshipService.removeFriend(friendshipId, addresseeId);

        verify(friendshipRepository).delete(accepted);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(requesterId, addresseeId)), any(WsEvent.class));
    }

    // --- listFriends / listPending ---

    @Test
    void listFriends_returnsAcceptedFriendsWithOnlineFlag() {
        UUID userId = UUID.randomUUID();
        UUID friendId = UUID.randomUUID();
        Friendship accepted = friendship(UUID.randomUUID(), userId, friendId, FriendshipStatus.ACCEPTED);
        when(friendshipRepository.findAcceptedForUser(userId)).thenReturn(List.of(accepted));
        when(userRepository.findAllById(List.of(friendId))).thenReturn(List.of(user(friendId, "bob")));
        when(sessionRegistry.isOnline(friendId)).thenReturn(true);

        List<FriendResponse> result = friendshipService.listFriends(userId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).user().id()).isEqualTo(friendId);
        assertThat(result.get(0).online()).isTrue();
    }

    @Test
    void listFriends_batchesUserLookups_insteadOfOneQueryPerFriend() {
        UUID userId = UUID.randomUUID();
        UUID friendA = UUID.randomUUID();
        UUID friendB = UUID.randomUUID();
        Friendship acceptedA = friendship(UUID.randomUUID(), userId, friendA, FriendshipStatus.ACCEPTED);
        Friendship acceptedB = friendship(UUID.randomUUID(), userId, friendB, FriendshipStatus.ACCEPTED);
        when(friendshipRepository.findAcceptedForUser(userId)).thenReturn(List.of(acceptedA, acceptedB));
        when(userRepository.findAllById(List.of(friendA, friendB)))
                .thenReturn(List.of(user(friendA, "alice"), user(friendB, "bob")));

        List<FriendResponse> result = friendshipService.listFriends(userId);

        assertThat(result).hasSize(2);
        verify(userRepository, never()).findById(any());
        verify(userRepository, times(1)).findAllById(any());
    }

    @Test
    void listPending_separatesIncomingFromOutgoing() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        Friendship incoming = friendship(UUID.randomUUID(), otherId, userId, FriendshipStatus.PENDING);
        Friendship outgoing = friendship(UUID.randomUUID(), userId, otherId, FriendshipStatus.PENDING);
        when(friendshipRepository.findByStatusAndAddresseeId(FriendshipStatus.PENDING, userId))
                .thenReturn(List.of(incoming));
        when(friendshipRepository.findByStatusAndRequesterId(FriendshipStatus.PENDING, userId))
                .thenReturn(List.of(outgoing));
        when(userRepository.findAllById(anyIterable())).thenReturn(List.of(user(otherId, "bob")));

        PendingFriendRequestsResponse result = friendshipService.listPending(userId);

        assertThat(result.incoming()).hasSize(1);
        assertThat(result.incoming().get(0).friendshipId()).isEqualTo(incoming.getId());
        assertThat(result.outgoing()).hasSize(1);
        assertThat(result.outgoing().get(0).friendshipId()).isEqualTo(outgoing.getId());
        verify(userRepository, never()).findById(any());
        verify(userRepository, times(1)).findAllById(any());
    }
}
