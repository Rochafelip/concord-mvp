package com.concordmvp.dm;

import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.friends.Friendship;
import com.concordmvp.friends.FriendshipRepository;
import com.concordmvp.friends.FriendshipStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DmConversationStateServiceTest {

    @Mock
    private DmConversationStateRepository repository;

    @Mock
    private FriendshipRepository friendshipRepository;

    private DmConversationStateService service;

    @BeforeEach
    void setUp() {
        service = new DmConversationStateService(repository, friendshipRepository);
    }

    private Friendship accepted(UUID a, UUID b) {
        Friendship friendship = new Friendship();
        friendship.setId(UUID.randomUUID());
        friendship.setRequesterId(a);
        friendship.setAddresseeId(b);
        friendship.setStatus(FriendshipStatus.ACCEPTED);
        return friendship;
    }

    // --- ensureVisible ---

    @Test
    void ensureVisible_alreadyVisible_doesNotSaveAgain() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(repository.existsByUserIdAndOtherUserId(userId, otherId)).thenReturn(true);

        service.ensureVisible(userId, otherId);

        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void ensureVisible_notYetVisible_savesWithGivenDirection() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(repository.existsByUserIdAndOtherUserId(userId, otherId)).thenReturn(false);

        service.ensureVisible(userId, otherId);

        ArgumentCaptor<DmConversationState> captor = ArgumentCaptor.forClass(DmConversationState.class);
        verify(repository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getOtherUserId()).isEqualTo(otherId);
    }

    @Test
    void ensureVisible_raceOnSave_swallowsConstraintViolation() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(repository.existsByUserIdAndOtherUserId(userId, otherId)).thenReturn(false);
        when(repository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("dup"));

        assertThatCode(() -> service.ensureVisible(userId, otherId)).doesNotThrowAnyException();
    }

    // --- listVisibleConversationIds ---

    @Test
    void listVisibleConversationIds_mapsToOtherUserId_inRepositoryOrder() {
        UUID userId = UUID.randomUUID();
        UUID other1 = UUID.randomUUID();
        UUID other2 = UUID.randomUUID();
        DmConversationState newer = state(userId, other1);
        DmConversationState older = state(userId, other2);
        when(repository.findAllByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(newer, older));

        List<UUID> result = service.listVisibleConversationIds(userId);

        assertThat(result).containsExactly(other1, other2);
    }

    private DmConversationState state(UUID userId, UUID otherUserId) {
        DmConversationState state = new DmConversationState();
        state.setId(UUID.randomUUID());
        state.setUserId(userId);
        state.setOtherUserId(otherUserId);
        return state;
    }

    // --- openConversation ---

    @Test
    void openConversation_notFriends_throwsForbidden() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(friendshipRepository.findByPair(userId, otherId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.openConversation(userId, otherId))
                .isInstanceOf(ForbiddenException.class);

        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void openConversation_pendingFriendship_throwsForbidden() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        Friendship pending = accepted(userId, otherId);
        pending.setStatus(FriendshipStatus.PENDING);
        when(friendshipRepository.findByPair(userId, otherId)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.openConversation(userId, otherId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void openConversation_friends_makesVisibleOnlyForRequester() {
        UUID userId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        when(friendshipRepository.findByPair(userId, otherId)).thenReturn(Optional.of(accepted(userId, otherId)));
        when(repository.existsByUserIdAndOtherUserId(userId, otherId)).thenReturn(false);

        service.openConversation(userId, otherId);

        ArgumentCaptor<DmConversationState> captor = ArgumentCaptor.forClass(DmConversationState.class);
        verify(repository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getOtherUserId()).isEqualTo(otherId);
        verify(repository, never()).existsByUserIdAndOtherUserId(otherId, userId);
    }
}
