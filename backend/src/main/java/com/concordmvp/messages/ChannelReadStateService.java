package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.realtime.dto.ChannelReadPayload;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChannelReadStateService {

    private final ChannelReadStateRepository channelReadStateRepository;
    private final ChannelRepository channelRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final MessageRepository messageRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final PermissionService permissionService;

    public ChannelReadStateService(ChannelReadStateRepository channelReadStateRepository,
                                    ChannelRepository channelRepository,
                                    ServerMemberRepository serverMemberRepository,
                                    MessageRepository messageRepository,
                                    RealtimeEventPublisher realtimeEventPublisher,
                                    PermissionService permissionService) {
        this.channelReadStateRepository = channelReadStateRepository;
        this.channelRepository = channelRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.messageRepository = messageRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.permissionService = permissionService;
    }

    @Transactional
    public ChannelReadState initializeReadState(UUID userId, UUID channelId) {
        return channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElseGet(() -> {
                    ChannelReadState state = new ChannelReadState();
                    state.setUserId(userId);
                    state.setChannelId(channelId);
                    state.setLastReadAt(Instant.now());
                    state.setUnreadCount(0);
                    return channelReadStateRepository.save(state);
                });
    }

    @Transactional
    public void incrementUnreadForChannelMembers(UUID channelId, List<UUID> memberIds, UUID authorId) {
        if (memberIds.isEmpty()) {
            return;
        }

        List<UUID> recipientIds = memberIds.stream()
                .filter(id -> !id.equals(authorId))
                .collect(Collectors.toList());

        if (!recipientIds.isEmpty()) {
            channelReadStateRepository.incrementUnreadCount(channelId, recipientIds);
        }
    }

    @Transactional
    public void markChannelAsRead(UUID userId, UUID channelId, UUID lastReadMessageId) {
        if (lastReadMessageId != null) {
            channelReadStateRepository.markAsRead(userId, channelId, lastReadMessageId);
        } else {
            channelReadStateRepository.markAsReadWithoutMessage(userId, channelId);
        }
        
        broadcastChannelRead(userId, channelId, lastReadMessageId);
    }

    @Transactional
    public void markChannelAsReadWithoutMessage(UUID userId, UUID channelId) {
        channelReadStateRepository.markAsReadWithoutMessage(userId, channelId);
    }

    public ChannelReadState getReadState(UUID userId, UUID channelId) {
        return channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElse(null);
    }

    public List<ChannelReadState> getUserReadStates(UUID userId) {
        return channelReadStateRepository.findByUserId(userId);
    }

    public Integer getUnreadCount(UUID userId, UUID channelId) {
        return channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .map(ChannelReadState::getUnreadCount)
                .orElse(0);
    }

    @Transactional
    public void recalculateUnreadCount(UUID userId, UUID channelId) {
        ChannelReadState state = channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElse(null);
        
        if (state == null) {
            return;
        }

        UUID lastReadMessageId = state.getLastReadMessageId();
        Instant lastReadAt = state.getLastReadAt();

        Integer unreadCount;
        if (lastReadMessageId != null) {
            Message lastReadMessage = messageRepository.findById(lastReadMessageId).orElse(null);
            if (lastReadMessage != null) {
                unreadCount = (int) messageRepository.countByChannelIdAndCreatedAtAfter(channelId, lastReadMessage.getCreatedAt());
            } else {
                unreadCount = (int) messageRepository.countByChannelIdAndCreatedAtAfter(channelId, lastReadAt);
            }
        } else {
            unreadCount = (int) messageRepository.countByChannelIdAndCreatedAtAfter(channelId, lastReadAt);
        }

        state.setUnreadCount(unreadCount);
        channelReadStateRepository.save(state);
    }

    @Transactional
    public void initializeReadStatesForServer(UUID serverId, UUID userId) {
        List<Channel> channels = channelRepository.findByServerId(serverId);
        for (Channel channel : channels) {
            initializeReadState(userId, channel.getId());
        }
    }
    
    private void broadcastChannelRead(UUID userId, UUID channelId, UUID lastReadMessageId) {
        try {
            Channel channel = channelRepository.findById(channelId).orElse(null);
            if (channel == null || !serverMemberRepository.existsByServerIdAndUserId(channel.getServerId(), userId)) {
                return;
            }
            // Only members who can actually see this channel may learn who read it and how many
            // messages are unread — plain server membership alone would leak that metadata for
            // private/restricted channels.
            Set<UUID> serverMemberIds = serverMemberRepository.findByServerId(channel.getServerId()).stream()
                    .map(ServerMember::getUserId)
                    .collect(Collectors.toSet());
            Set<UUID> recipients = permissionService.visibleMemberIds(channel, serverMemberIds);
            
            ChannelReadState state = getReadState(userId, channelId);
            Integer unreadCount = state != null ? state.getUnreadCount() : 0;
            
            realtimeEventPublisher.broadcast(recipients, new WsEvent(WsEventType.CHANNEL_READ,
                    new ChannelReadPayload(channelId, userId, lastReadMessageId, unreadCount)));
        } catch (Exception e) {
            System.err.println("Failed to broadcast CHANNEL_READ event: " + e.getMessage());
        }
    }
}
