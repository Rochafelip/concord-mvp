package com.concordmvp.dm;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.dm.dto.DmMessageResponse;
import com.concordmvp.friends.Friendship;
import com.concordmvp.friends.FriendshipRepository;
import com.concordmvp.friends.FriendshipStatus;
import com.concordmvp.realtime.RealtimeEventPublisher;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DmMessageServiceTest {

    @Mock
    private DmMessageRepository dmMessageRepository;

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    private DmMessageService dmMessageService;

    @BeforeEach
    void setUp() {
        dmMessageService = new DmMessageService(dmMessageRepository, friendshipRepository, userRepository,
                realtimeEventPublisher);
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

    private Friendship accepted(UUID a, UUID b) {
        Friendship friendship = new Friendship();
        friendship.setId(UUID.randomUUID());
        friendship.setRequesterId(a);
        friendship.setAddresseeId(b);
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        return friendship;
    }

    private void stubAcceptedFriendship(UUID a, UUID b) {
        when(friendshipRepository.findByPair(a, b)).thenReturn(Optional.of(accepted(a, b)));
    }

    private void stubSaveAssignsId() {
        when(dmMessageRepository.save(any(DmMessage.class))).thenAnswer(inv -> {
            DmMessage message = inv.getArgument(0);
            if (message.getId() == null) message.setId(UUID.randomUUID());
            return message;
        });
    }

    // --- sendMessage ---

    @Test
    void sendMessage_self_throwsBadRequest() {
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() -> dmMessageService.sendMessage(userId, userId, "hi"))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(dmMessageRepository, realtimeEventPublisher);
    }

    @Test
    void sendMessage_recipientNotFound_throwsResourceNotFound() {
        UUID authorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        when(userRepository.findById(recipientId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dmMessageService.sendMessage(authorId, recipientId, "hi"))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(dmMessageRepository, realtimeEventPublisher);
    }

    @Test
    void sendMessage_noFriendship_throwsForbidden() {
        UUID authorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(user(recipientId, "bob")));
        when(friendshipRepository.findByPair(authorId, recipientId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dmMessageService.sendMessage(authorId, recipientId, "hi"))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(dmMessageRepository, realtimeEventPublisher);
    }

    @Test
    void sendMessage_pendingFriendship_throwsForbidden() {
        UUID authorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        Friendship pending = accepted(authorId, recipientId);
        pending.setStatus(FriendshipStatus.PENDING);
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(user(recipientId, "bob")));
        when(friendshipRepository.findByPair(authorId, recipientId)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> dmMessageService.sendMessage(authorId, recipientId, "hi"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void sendMessage_blankContent_throwsBadRequest() {
        UUID authorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(user(recipientId, "bob")));
        stubAcceptedFriendship(authorId, recipientId);

        assertThatThrownBy(() -> dmMessageService.sendMessage(authorId, recipientId, "   "))
                .isInstanceOf(BadRequestException.class);

        verify(dmMessageRepository, never()).save(any());
    }

    @Test
    void sendMessage_tooLongContent_throwsBadRequest() {
        UUID authorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(user(recipientId, "bob")));
        stubAcceptedFriendship(authorId, recipientId);

        assertThatThrownBy(() -> dmMessageService.sendMessage(authorId, recipientId, "a".repeat(4001)))
                .isInstanceOf(BadRequestException.class);

        verify(dmMessageRepository, never()).save(any());
    }

    @Test
    void sendMessage_valid_persistsNormalizedPair_andBroadcastsToBothUsers() {
        UUID authorId = UUID.randomUUID();
        UUID recipientId = UUID.randomUUID();
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(user(recipientId, "bob")));
        when(userRepository.findById(authorId)).thenReturn(Optional.of(user(authorId, "alice")));
        stubAcceptedFriendship(authorId, recipientId);
        stubSaveAssignsId();

        DmMessage result = dmMessageService.sendMessage(authorId, recipientId, "  hello  ");

        assertThat(result.getContent()).isEqualTo("hello");
        assertThat(result.getAuthorId()).isEqualTo(authorId);
        assertThat(List.of(result.getUserLowId(), result.getUserHighId()))
                .containsExactlyInAnyOrder(authorId, recipientId);
        assertThat(result.getUserLowId()).isLessThan(result.getUserHighId());

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(authorId, recipientId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.DM_MESSAGE_CREATE);
        DmMessageResponse payload = (DmMessageResponse) eventCaptor.getValue().payload();
        assertThat(payload.content()).isEqualTo("hello");
        assertThat(payload.author().id()).isEqualTo(authorId);
        assertThat(payload.recipientId()).isEqualTo(recipientId);
    }

    // --- getHistory ---

    @Test
    void getHistory_self_throwsBadRequest() {
        UUID userId = UUID.randomUUID();

        assertThatThrownBy(() -> dmMessageService.getHistory(userId, userId, null, null, 50))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void getHistory_otherUserNotFound_throwsResourceNotFound() {
        UUID requesterId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(userRepository.findById(otherId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> dmMessageService.getHistory(requesterId, otherId, null, null, 50))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getHistory_beforeWithoutBeforeId_throwsBadRequest() {
        UUID requesterId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(userRepository.findById(otherId)).thenReturn(Optional.of(user(otherId, "bob")));

        assertThatThrownBy(() -> dmMessageService.getHistory(requesterId, otherId, Instant.now(), null, 50))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void getHistory_returnsChronologicalOrder_despiteRepositoryReturningNewestFirst() {
        UUID requesterId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID low = requesterId.compareTo(otherId) < 0 ? requesterId : otherId;
        UUID high = requesterId.compareTo(otherId) < 0 ? otherId : requesterId;
        when(userRepository.findById(otherId)).thenReturn(Optional.of(user(otherId, "bob")));
        when(userRepository.findAllById(any())).thenReturn(List.of(user(otherId, "bob")));

        Instant now = Instant.now();
        DmMessage newest = message(low, high, otherId, "newest", now);
        DmMessage oldest = message(low, high, otherId, "oldest", now.minus(1, ChronoUnit.MINUTES));
        when(dmMessageRepository.findByUserLowIdAndUserHighIdOrderByCreatedAtDescIdDesc(eq(low), eq(high), any()))
                .thenReturn(List.of(newest, oldest));

        List<DmMessageResponse> result = dmMessageService.getHistory(requesterId, otherId, null, null, 50);

        assertThat(result).extracting(DmMessageResponse::content).containsExactly("oldest", "newest");
    }

    @Test
    void getHistory_limitAboveMax_clampedTo100() {
        UUID requesterId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(userRepository.findById(otherId)).thenReturn(Optional.of(user(otherId, "bob")));
        when(dmMessageRepository.findByUserLowIdAndUserHighIdOrderByCreatedAtDescIdDesc(any(), any(), any()))
                .thenReturn(List.of());

        dmMessageService.getHistory(requesterId, otherId, null, null, 1000);

        ArgumentCaptor<org.springframework.data.domain.Pageable> pageableCaptor =
                ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(dmMessageRepository).findByUserLowIdAndUserHighIdOrderByCreatedAtDescIdDesc(
                any(), any(), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(100);
    }

    private DmMessage message(UUID low, UUID high, UUID authorId, String content, Instant createdAt) {
        DmMessage message = new DmMessage();
        message.setId(UUID.randomUUID());
        message.setUserLowId(low);
        message.setUserHighId(high);
        message.setAuthorId(authorId);
        message.setContent(content);
        setCreatedAt(message, createdAt);
        return message;
    }

    private void setCreatedAt(DmMessage message, Instant createdAt) {
        try {
            var field = DmMessage.class.getDeclaredField("createdAt");
            field.setAccessible(true);
            field.set(message, createdAt);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }
}
