package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.media.dto.VoicePresenceLeavePayload;
import com.concordmvp.media.dto.VoicePresenceResponse;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.dto.UserSummaryResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Tracks who is currently in which voice channel, and with what mic/camera/screen-share/speaking
 * state, driven entirely by reports from clients already connected to that channel (see
 * docs/superpowers/specs/2026-09-04-voice-channel-participant-preview-design.md §3.1 for why this
 * isn't LiveKit-webhook-driven). In-memory only, one entry per user — matches
 * WebSocketSessionRegistry's D3 in-memory-single-instance policy and this app's one-call-at-a-time
 * model.
 */
@Service
public class VoicePresenceService {

    private record Entry(UUID channelId, UUID serverId, VoicePresenceResponse response) {
    }

    private final ConcurrentHashMap<UUID, Entry> byUserId = new ConcurrentHashMap<>();

    private final ChannelService channelService;
    private final ServerMemberRepository serverMemberRepository;
    private final UserRepository userRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public VoicePresenceService(ChannelService channelService,
                                 ServerMemberRepository serverMemberRepository,
                                 UserRepository userRepository,
                                 RealtimeEventPublisher realtimeEventPublisher) {
        this.channelService = channelService;
        this.serverMemberRepository = serverMemberRepository;
        this.userRepository = userRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    public void updatePresence(UUID channelId, UUID userId, boolean muted, boolean cameraOn,
                                boolean screenSharing, boolean speaking) {
        Channel channel = channelService.getChannel(channelId, userId);
        if (channel.getType() != ChannelType.VOICE) {
            throw new BadRequestException("Channel is not a voice channel: " + channelId);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        VoicePresenceResponse response = new VoicePresenceResponse(
                channel.getServerId(), channelId,
                new UserSummaryResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getAvatarUrl()),
                muted, cameraOn, screenSharing, speaking);

        byUserId.put(userId, new Entry(channelId, channel.getServerId(), response));

        realtimeEventPublisher.broadcast(currentMemberIds(channel.getServerId()),
                new WsEvent(WsEventType.VOICE_PRESENCE_UPDATE, response));
    }

    public void removePresence(UUID userId) {
        Entry removed = byUserId.remove(userId);
        if (removed == null) return;

        realtimeEventPublisher.broadcast(currentMemberIds(removed.serverId()),
                new WsEvent(WsEventType.VOICE_PRESENCE_LEAVE,
                        new VoicePresenceLeavePayload(removed.serverId(), removed.channelId(), userId)));
    }

    public List<VoicePresenceResponse> getPresence(UUID serverId, UUID requesterId) {
        if (!serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)) {
            throw new ForbiddenException("Not a member of this server: " + serverId);
        }

        return byUserId.values().stream()
                .filter(entry -> entry.serverId().equals(serverId))
                .map(Entry::response)
                .toList();
    }

    private Set<UUID> currentMemberIds(UUID serverId) {
        return serverMemberRepository.findByServerId(serverId).stream()
                .map(ServerMember::getUserId)
                .collect(Collectors.toSet());
    }
}
