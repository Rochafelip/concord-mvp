package com.concordmvp.dm;

import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.friends.FriendshipRepository;
import com.concordmvp.friends.FriendshipStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Tracks, per user, which DM conversations are visible in their conversation list. Accepting a
 * friend request never calls this — a conversation only becomes visible when a user opens it,
 * sends a message, or places/receives a call
 * (docs/superpowers/specs/2026-09-23-dm-conversation-visibility-design.md).
 */
@Service
public class DmConversationStateService {

    private final DmConversationStateRepository repository;
    private final FriendshipRepository friendshipRepository;

    public DmConversationStateService(DmConversationStateRepository repository,
                                       FriendshipRepository friendshipRepository) {
        this.repository = repository;
        this.friendshipRepository = friendshipRepository;
    }

    /** Explicit "I opened this chat" trigger. Requires an accepted friendship, same as sending
     *  a message or placing a call — only makes the conversation visible for {@code userId}. */
    public void openConversation(UUID userId, UUID otherUserId) {
        requireFriends(userId, otherUserId);
        ensureVisible(userId, otherUserId);
    }

    /**
     * Makes the conversation with {@code otherUserId} visible in {@code userId}'s list, if it
     * isn't already. Runs in its own transaction and flushes immediately so a unique-constraint
     * race (two requests both passing the exists check at once) surfaces here and is discarded,
     * instead of marking a caller's own transaction (e.g. sending a message) rollback-only.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureVisible(UUID userId, UUID otherUserId) {
        if (repository.existsByUserIdAndOtherUserId(userId, otherUserId)) {
            return;
        }
        DmConversationState state = new DmConversationState();
        state.setUserId(userId);
        state.setOtherUserId(otherUserId);
        try {
            repository.saveAndFlush(state);
        } catch (DataIntegrityViolationException e) {
            // Another request already created it between the exists check and this flush.
        }
    }

    public List<UUID> listVisibleConversationIds(UUID userId) {
        return repository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(DmConversationState::getOtherUserId)
                .toList();
    }

    private void requireFriends(UUID userA, UUID userB) {
        friendshipRepository.findByPair(userA, userB)
                .filter(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                .orElseThrow(() -> new ForbiddenException("Você só pode abrir conversas com amigos"));
    }
}
