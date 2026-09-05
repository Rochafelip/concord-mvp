package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.dto.MessageResponse;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.User;
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
import java.util.stream.Collectors;

/**
 * Business logic for messages. Reuses {@link ChannelService#getChannel(UUID, UUID)} for the
 * "channel exists (404) + requester is a member of its server (403)" check rather than
 * re-deriving it from raw repositories — that check is already recommended for reuse by a prior
 * code review of the {@code channels} module.
 *
 * <p>Also reaches into {@code servers.ServerMemberRepository} and {@code users.UserRepository}
 * directly (same established cross-module pattern used elsewhere) to build the broadcast
 * recipient set and populate the message author's summary.
 */
@Service
public class MessageService {

    private static final int DEFAULT_HISTORY_LIMIT = 50;
    private static final int MAX_HISTORY_LIMIT = 100;
    private static final int MAX_CONTENT_LENGTH = 4000;

    private final MessageRepository messageRepository;
    private final ChannelService channelService;
    private final ServerMemberRepository serverMemberRepository;
    private final UserRepository userRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public MessageService(MessageRepository messageRepository,
                           ChannelService channelService,
                           ServerMemberRepository serverMemberRepository,
                           UserRepository userRepository,
                           RealtimeEventPublisher realtimeEventPublisher) {
        this.messageRepository = messageRepository;
        this.channelService = channelService;
        this.serverMemberRepository = serverMemberRepository;
        this.userRepository = userRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    public static final UUID SYSTEM_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Transactional
    public Message sendMessage(UUID channelId, String content, UUID authorId) {
        Channel channel = channelService.getChannel(channelId, authorId);

        if (channel.getType() == ChannelType.ONBOARDING) {
            throw new ForbiddenException("This channel is read-only");
        }

        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("Message content must not be empty");
        }
        if (trimmed.length() > MAX_CONTENT_LENGTH) {
            throw new BadRequestException("Message content is too long");
        }

        return persistAndBroadcast(channelId, channel.getServerId(), authorId, trimmed);
    }

    /**
     * Posts a message authored by the reserved {@link #SYSTEM_USER_ID} user, bypassing the
     * membership/content checks {@link #sendMessage} enforces — this is only ever called from
     * trusted internal code (server creation / join), never reachable from user input. Used for
     * the onboarding channel's automatic join announcements.
     */
    @Transactional
    public Message postSystemMessage(UUID channelId, UUID serverId, String content) {
        return persistAndBroadcast(channelId, serverId, SYSTEM_USER_ID, content);
    }

    private Message persistAndBroadcast(UUID channelId, UUID serverId, UUID authorId, String content) {
        Message message = new Message();
        message.setChannelId(channelId);
        message.setAuthorId(authorId);
        message.setContent(content);
        Message saved = messageRepository.save(message);

        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + authorId));

        Set<UUID> recipients = currentMemberIds(serverId);
        MessageResponse payload = toResponse(saved, author);
        // WARNING: MESSAGE_CREATE is broadcast here, before this @Transactional method returns
        // and the transaction commits (docs/DATABASE.md §34 specifies persist -> commit ->
        // broadcast). If commit fails after this point, clients will have seen a message that
        // was never actually persisted. Same risk class as the broadcast-before-commit warning
        // in ServerService.deleteServer — a proper fix (e.g. deferring this to a
        // @TransactionalEventListener(phase = AFTER_COMMIT)) is a deliberate future decision,
        // not something to sneak in here.
        realtimeEventPublisher.broadcast(recipients, new WsEvent(WsEventType.MESSAGE_CREATE, payload));

        return saved;
    }

    /**
     * @param before   exclusive upper bound on {@code createdAt} for the compound cursor; {@code
     *                 null} for the first (most recent) page.
     * @param beforeId tiebreak for messages sharing {@code before}'s exact timestamp — required
     *                 whenever {@code before} is non-null (paired with the last message's id
     *                 from the previous page), since a timestamp alone cannot disambiguate
     *                 messages created in the same instant.
     */
    public List<MessageResponse> getHistory(UUID channelId, Instant before, UUID beforeId, int limit, UUID requesterId) {
        channelService.getChannel(channelId, requesterId);

        if (before != null && beforeId == null) {
            throw new BadRequestException("beforeId is required when before is provided");
        }

        int effectiveLimit = limit <= 0 ? DEFAULT_HISTORY_LIMIT : Math.min(limit, MAX_HISTORY_LIMIT);
        Pageable page = PageRequest.of(0, effectiveLimit);

        List<Message> messages = before == null
                ? messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(channelId, page)
                : messageRepository.findPageBefore(channelId, before, beforeId, page);

        List<Message> chronological = new ArrayList<>(messages);
        Collections.reverse(chronological);

        List<UUID> authorIds = chronological.stream().map(Message::getAuthorId).distinct().toList();
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

    private Set<UUID> currentMemberIds(UUID serverId) {
        return serverMemberRepository.findByServerId(serverId).stream()
                .map(ServerMember::getUserId)
                .collect(Collectors.toSet());
    }

    private MessageResponse toResponse(Message message, User author) {
        UserSummaryResponse authorSummary = new UserSummaryResponse(
                author.getId(), author.getUsername(), author.getDisplayName(), author.getAvatarUrl());
        return new MessageResponse(message.getId(), message.getChannelId(), authorSummary,
                message.getContent(), message.getCreatedAt());
    }
}
