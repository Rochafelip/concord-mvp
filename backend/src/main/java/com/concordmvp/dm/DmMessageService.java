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
import com.concordmvp.users.UserAvatarUrls;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.dto.UserSummaryResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Business logic for direct messages. Authorization is intentionally simple compared to {@code
 * messages.MessageService}: there are no roles or per-channel overrides here — the only rule is
 * "the two participants, and only while they are friends, may exchange new messages." History
 * stays readable after an unfriend (see FriendshipService); only {@link #sendMessage} checks
 * friendship status.
 */
@Service
public class DmMessageService {

    private static final int DEFAULT_HISTORY_LIMIT = 50;
    private static final int MAX_HISTORY_LIMIT = 100;
    private static final int MAX_CONTENT_LENGTH = 4000;

    private final DmMessageRepository dmMessageRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final DmConversationStateService dmConversationStateService;

    public DmMessageService(DmMessageRepository dmMessageRepository,
                             FriendshipRepository friendshipRepository,
                             UserRepository userRepository,
                             RealtimeEventPublisher realtimeEventPublisher,
                             DmConversationStateService dmConversationStateService) {
        this.dmMessageRepository = dmMessageRepository;
        this.friendshipRepository = friendshipRepository;
        this.userRepository = userRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.dmConversationStateService = dmConversationStateService;
    }

    @Transactional
    public DmMessage sendMessage(UUID authorId, UUID otherUserId, String content) {
        if (authorId.equals(otherUserId)) {
            throw new BadRequestException("Você não pode enviar uma mensagem para si mesmo");
        }
        userRepository.findById(otherUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + otherUserId));
        requireFriends(authorId, otherUserId);

        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("A mensagem não pode estar vazia");
        }
        if (trimmed.length() > MAX_CONTENT_LENGTH) {
            throw new BadRequestException("A mensagem é muito longa");
        }

        DmMessage message = new DmMessage();
        message.setUserLowId(low(authorId, otherUserId));
        message.setUserHighId(high(authorId, otherUserId));
        message.setAuthorId(authorId);
        message.setContent(trimmed);
        DmMessage saved = dmMessageRepository.save(message);
        dmConversationStateService.ensureVisible(authorId, otherUserId);
        dmConversationStateService.ensureVisible(otherUserId, authorId);

        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + authorId));
        DmMessageResponse payload = toResponse(saved, author);

        realtimeEventPublisher.broadcast(Set.of(authorId, otherUserId),
                new WsEvent(WsEventType.DM_MESSAGE_CREATE, payload));

        return saved;
    }

    /**
     * @param before   exclusive upper bound on {@code createdAt} for the compound cursor; {@code
     *                 null} for the first (most recent) page.
     * @param beforeId tiebreak for messages sharing {@code before}'s exact timestamp — required
     *                 whenever {@code before} is non-null.
     */
    public List<DmMessageResponse> getHistory(UUID requesterId, UUID otherUserId, Instant before, UUID beforeId,
                                               int limit) {
        if (requesterId.equals(otherUserId)) {
            throw new BadRequestException("Não há conversa privada com você mesmo");
        }
        userRepository.findById(otherUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + otherUserId));
        if (before != null && beforeId == null) {
            throw new BadRequestException("beforeId is required when before is provided");
        }

        UUID userLowId = low(requesterId, otherUserId);
        UUID userHighId = high(requesterId, otherUserId);
        int effectiveLimit = limit <= 0 ? DEFAULT_HISTORY_LIMIT : Math.min(limit, MAX_HISTORY_LIMIT);
        Pageable page = PageRequest.of(0, effectiveLimit);

        List<DmMessage> messages = before == null
                ? dmMessageRepository.findByUserLowIdAndUserHighIdOrderByCreatedAtDescIdDesc(userLowId, userHighId, page)
                : dmMessageRepository.findPageBefore(userLowId, userHighId, before, beforeId, page);

        List<DmMessage> chronological = new ArrayList<>(messages);
        Collections.reverse(chronological);

        List<UUID> authorIds = chronological.stream().map(DmMessage::getAuthorId).distinct().toList();
        List<User> authors = userRepository.findAllById(authorIds);

        return chronological.stream()
                .map(message -> {
                    User author = authors.stream()
                            .filter(u -> u.getId().equals(message.getAuthorId()))
                            .findFirst()
                            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + message.getAuthorId()));
                    return toResponse(message, author);
                })
                .toList();
    }

    // ------------------------------------------------------------------ internals

    private void requireFriends(UUID userA, UUID userB) {
        friendshipRepository.findByPair(userA, userB)
                .filter(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                .orElseThrow(() -> new ForbiddenException("Você só pode enviar mensagens para amigos"));
    }

    // Ordered by the same comparison V20's chk_dm_messages_ordered_pair constraint uses:
    // PostgreSQL's `uuid <` operator, an unsigned byte-wise comparison. java.util.UUID.compareTo()
    // instead compares mostSigBits/leastSigBits as SIGNED longs, which disagrees with Postgres
    // whenever the two UUIDs' leading hex digit falls on opposite sides of 8 — silently rolling
    // back every message between such a pair (the insert violates the check constraint at commit
    // time, after the DM_MESSAGE_CREATE broadcast has already gone out). Comparing the canonical
    // (lowercase, per UUID#toString) hex string lexicographically reproduces Postgres's ordering.
    private UUID low(UUID a, UUID b) {
        return a.toString().compareTo(b.toString()) < 0 ? a : b;
    }

    private UUID high(UUID a, UUID b) {
        return a.toString().compareTo(b.toString()) < 0 ? b : a;
    }

    private DmMessageResponse toResponse(DmMessage message, User author) {
        UserSummaryResponse authorSummary = new UserSummaryResponse(
                author.getId(), author.getUsername(), author.getDisplayName(), UserAvatarUrls.url(author));
        return new DmMessageResponse(message.getId(), authorSummary, message.recipientId(),
                message.getContent(), message.getCreatedAt());
    }
}
