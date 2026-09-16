package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.permissions.Permission;
import com.concordmvp.permissions.PermissionService;
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
import com.concordmvp.servers.ServerRepository;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.UserAvatarUrls;
import com.concordmvp.users.dto.UserSummaryResponse;
import org.springframework.beans.factory.annotation.Autowired;
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
        private final ServerRepository serverRepository;
    private final UserRepository userRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final PermissionService permissionService;

        @Autowired
        public VoicePresenceService(ChannelService channelService,
                                 ServerMemberRepository serverMemberRepository,
                                 ServerRepository serverRepository,
                                 UserRepository userRepository,
                                 RealtimeEventPublisher realtimeEventPublisher,
                                 PermissionService permissionService) {
        this.permissionService = permissionService;
        this.channelService = channelService;
        this.serverMemberRepository = serverMemberRepository;
        this.serverRepository = serverRepository;
        this.userRepository = userRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    public void updatePresence(UUID channelId, UUID userId, boolean muted, boolean cameraOn,
                                boolean screenSharing, boolean speaking, boolean deafened) {
        Channel channel = channelService.getChannel(channelId, userId);
        if (channel.getType() != ChannelType.VOICE) {
            throw new BadRequestException("Channel is not a voice channel: " + channelId);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        String displayName = serverMemberRepository.findByServerIdAndUserId(channel.getServerId(), userId)
                .map(ServerMember::getDisplayName)
                .filter(name -> name != null && !name.isBlank())
                .orElse(user.getDisplayName());

        VoicePresenceResponse response = new VoicePresenceResponse(
                channel.getServerId(), channelId,
                new UserSummaryResponse(user.getId(), user.getUsername(), displayName, UserAvatarUrls.url(user)),
                muted, cameraOn, screenSharing, speaking, deafened);

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

        // One VIEW_CHANNEL check per occupied voice channel. The map only ever holds people
        // currently connected to voice, so this is a handful of entries, not the channel list.
        return byUserId.values().stream()
                .filter(entry -> entry.serverId().equals(serverId))
                .filter(entry -> permissionService.hasChannel(entry.channelId(), requesterId,
                        Permission.VIEW_CHANNEL))
                .map(Entry::response)
                .toList();
    }

        public void disconnectParticipant(UUID channelId, UUID targetUserId, UUID requesterId) {
                Channel channel = channelService.getChannel(channelId, requesterId);
                UUID serverId = channel.getServerId();
                if (targetUserId.equals(requesterId)) {
                        throw new BadRequestException("Você não pode desconectar a si mesmo");
                }
                permissionService.requireChannel(channel, requesterId, Permission.DISCONNECT_MEMBERS);
                if (!permissionService.outranks(serverId, requesterId, targetUserId)) {
                        throw new ForbiddenException(
                                        "Você não pode desconectar alguém no seu nível ou acima");
                }

                Entry entry = byUserId.get(targetUserId);
                if (entry == null || !entry.channelId().equals(channelId)) {
                        throw new ResourceNotFoundException("User is not connected to this voice channel");
                }

                realtimeEventPublisher.broadcast(currentMemberIds(serverId), new WsEvent(
                        WsEventType.VOICE_KICK,
                        new VoicePresenceLeavePayload(serverId, channelId, targetUserId)));
                removePresence(targetUserId);
        }

    private Set<UUID> currentMemberIds(UUID serverId) {
        return serverMemberRepository.findByServerId(serverId).stream()
                .map(ServerMember::getUserId)
                .collect(Collectors.toSet());
    }
}
