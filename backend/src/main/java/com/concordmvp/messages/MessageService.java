package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.common.exception.BadRequestException;
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

    @Transactional
    public Message sendMessage(UUID channelId, String content, UUID authorId) {
        Channel channel = channelService.getChannel(channelId, authorId);

        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("Message content must not be empty");
        }
        if (trimmed.length() > MAX_CONTENT_LENGTH) {
            throw new BadRequestException("Message content is too long");
        }

        Message message = new Message();
        message.setChannelId(channelId);
        message.setAuthorId(authorId);
        message.setContent(trimmed);
        Message saved = messageRepository.save(message);

        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + authorId));

        Set<UUID> recipients = currentMemberIds(channel.getServerId());
        MessageResponse payload = toResponse(saved, author);
        realtimeEventPublisher.broadcast(recipients, new WsEvent(WsEventType.MESSAGE_CREATE, payload));

        return saved;
    }

    public List<MessageResponse> getHistory(UUID channelId, Instant before, int limit, UUID requesterId) {
        channelService.getChannel(channelId, requesterId);

        int effectiveLimit = limit <= 0 ? DEFAULT_HISTORY_LIMIT : Math.min(limit, MAX_HISTORY_LIMIT);
        Pageable page = PageRequest.of(0, effectiveLimit);

        List<Message> messages = before == null
                ? messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(channelId, page)
                : messageRepository.findByChannelIdAndCreatedAtBeforeOrderByCreatedAtDescIdDesc(channelId, before, page);

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
