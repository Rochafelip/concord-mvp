package com.concordmvp.channels;

import com.concordmvp.channels.dto.ChannelDeletedPayload;
import com.concordmvp.channels.dto.ChannelResponse;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.MessageRepository;
import com.concordmvp.messages.AttachmentCleanupService;
import com.concordmvp.messages.ChannelReadStateService;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.Server;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.servers.ServerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Business logic for channels. Reuses {@code servers.ServerRepository}/{@code
 * ServerMemberRepository} directly for authorization lookups — this project's established
 * pattern is for a module to depend on another module's repositories directly for simple
 * read-only checks, rather than going through that module's service layer.
 */
@Service
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final ServerRepository serverRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final MessageRepository messageRepository;
    private final AttachmentCleanupService attachmentCleanupService;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final ChannelReadStateService channelReadStateService;

    @Autowired
    public ChannelService(ChannelRepository channelRepository,
                           ServerRepository serverRepository,
                           ServerMemberRepository serverMemberRepository,
                           MessageRepository messageRepository,
                           AttachmentCleanupService attachmentCleanupService,
                           RealtimeEventPublisher realtimeEventPublisher,
                           ChannelReadStateService channelReadStateService) {
        this.channelRepository = channelRepository;
        this.serverRepository = serverRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.messageRepository = messageRepository;
        this.attachmentCleanupService = attachmentCleanupService;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.channelReadStateService = channelReadStateService;
    }

    @Transactional
    public Channel createChannel(UUID serverId, String name, ChannelType type, UUID requesterId) {
        if (type == ChannelType.ONBOARDING) {
            throw new BadRequestException("The onboarding channel is managed by the system and cannot be created manually");
        }

        Server server = requireServer(serverId);

        if (!server.getOwnerId().equals(requesterId)) {
            throw new ForbiddenException("Only the server owner can create channels");
        }

        Channel channel = new Channel();
        channel.setServerId(serverId);
        channel.setName(name);
        channel.setType(type);
        Channel saved = channelRepository.save(channel);

        // Initialize read states for all server members for the new channel
        if (channelReadStateService != null) {
            try {
                for (UUID memberId : currentMemberIds(serverId)) {
                    channelReadStateService.initializeReadState(memberId, saved.getId());
                }
            } catch (Exception e) {
                // Log but don't fail channel creation if read state initialization fails
                // This ensures channel creation is not impacted by read state tracking issues
                System.err.println("Failed to initialize read states for new channel " + saved.getId() + ": " + e.getMessage());
            }
        }

        Set<UUID> recipients = currentMemberIds(serverId);
        ChannelResponse payload = toResponse(saved);
        realtimeEventPublisher.broadcast(recipients, new WsEvent(WsEventType.CHANNEL_CREATE, payload));

        return saved;
    }

    @Transactional
    public void deleteChannel(UUID channelId, UUID requesterId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel not found: " + channelId));

        if (channel.getType() == ChannelType.ONBOARDING) {
            throw new BadRequestException("The onboarding channel is managed by the system and cannot be deleted");
        }

        Server server = requireServer(channel.getServerId());

        if (!server.getOwnerId().equals(requesterId)) {
            throw new ForbiddenException("Only the server owner can delete channels");
        }

        List<com.concordmvp.messages.Message> messages = messageRepository.findByChannelIdIn(List.of(channelId));
        attachmentCleanupService.deleteForMessages(messages);
        messageRepository.deleteByChannelIdIn(List.of(channelId));
        channelRepository.delete(channel);

        Set<UUID> recipients = currentMemberIds(channel.getServerId());
        realtimeEventPublisher.broadcast(recipients,
                new WsEvent(WsEventType.CHANNEL_DELETE, new ChannelDeletedPayload(channelId, channel.getServerId())));
    }

    public List<Channel> listChannels(UUID serverId, UUID requesterId) {
        requireServer(serverId);
        requireMember(serverId, requesterId);
        return channelRepository.findByServerId(serverId);
    }

    public Channel getChannel(UUID channelId, UUID requesterId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel not found: " + channelId));

        requireMember(channel.getServerId(), requesterId);

        return channel;
    }

    private Server requireServer(UUID serverId) {
        return serverRepository.findById(serverId)
                .orElseThrow(() -> new ResourceNotFoundException("Server not found: " + serverId));
    }

    private void requireMember(UUID serverId, UUID userId) {
        if (!serverMemberRepository.existsByServerIdAndUserId(serverId, userId)) {
            throw new ForbiddenException("Not a member of this server");
        }
    }

    private Set<UUID> currentMemberIds(UUID serverId) {
        return serverMemberRepository.findByServerId(serverId).stream()
                .map(ServerMember::getUserId)
                .collect(Collectors.toSet());
    }

    private ChannelResponse toResponse(Channel channel) {
        Integer unreadCount = null;
        // Note: unreadCount is set to null here since we don't have the userId context
        // The frontend will fetch unread counts separately or they will be included
        // in channel-specific responses
        return new ChannelResponse(channel.getId(), channel.getServerId(), channel.getName(),
                channel.getType(), channel.getCreatedAt(), channel.getUpdatedAt(), unreadCount);
    }
}
