package com.concordmvp.channels;

import com.concordmvp.channels.dto.ChannelDeletedPayload;
import com.concordmvp.channels.dto.ChannelResponse;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.MessageRepository;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.Server;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.servers.ServerRepository;
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
    private final RealtimeEventPublisher realtimeEventPublisher;

    public ChannelService(ChannelRepository channelRepository,
                           ServerRepository serverRepository,
                           ServerMemberRepository serverMemberRepository,
                           MessageRepository messageRepository,
                           RealtimeEventPublisher realtimeEventPublisher) {
        this.channelRepository = channelRepository;
        this.serverRepository = serverRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.messageRepository = messageRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
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
        return new ChannelResponse(channel.getId(), channel.getServerId(), channel.getName(),
                channel.getType(), channel.getCreatedAt(), channel.getUpdatedAt());
    }
}
