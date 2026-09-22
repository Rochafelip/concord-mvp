package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.media.dto.WhistlePayload;
import com.concordmvp.permissions.Permission;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks who is currently whistling to whom (docs/superpowers/specs/2026-09-22-private-whistle-design.md).
 * The actual audio routing happens entirely client-side via LiveKit's per-participant track
 * subscription permissions — this service only authorizes the action and syncs UI state between
 * the two users involved. In-memory only, one entry per sender — same pattern as
 * {@link VoicePresenceService}.
 */
@Service
public class WhistleService {

    private record Entry(UUID channelId, UUID targetUserId) {
    }

    private final ConcurrentHashMap<UUID, Entry> bySenderId = new ConcurrentHashMap<>();

    private final ChannelService channelService;
    private final PermissionService permissionService;
    private final VoicePresenceService voicePresenceService;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public WhistleService(ChannelService channelService, PermissionService permissionService,
                           VoicePresenceService voicePresenceService,
                           RealtimeEventPublisher realtimeEventPublisher) {
        this.channelService = channelService;
        this.permissionService = permissionService;
        this.voicePresenceService = voicePresenceService;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    public void start(UUID channelId, UUID targetUserId, UUID senderId) {
        if (targetUserId.equals(senderId)) {
            throw new BadRequestException("Você não pode assobiar para si mesmo");
        }

        Channel channel = channelService.getChannel(channelId, senderId);
        if (channel.getType() != ChannelType.VOICE) {
            throw new BadRequestException("Channel is not a voice channel: " + channelId);
        }
        permissionService.requireChannel(channel, senderId, Permission.SPEAK);

        // Having SPEAK in the channel isn't the same as actually being in its LiveKit room — a
        // member who never joined (or is connected to a different voice channel) must not be able
        // to trigger a fake "X is whistling to you" indicator on some other connected member.
        if (!voicePresenceService.isConnected(channelId, senderId)) {
            throw new ResourceNotFoundException("You are not connected to this voice channel");
        }
        if (!voicePresenceService.isConnected(channelId, targetUserId)) {
            throw new ResourceNotFoundException("User is not connected to this voice channel");
        }

        // Defensive: normal push-to-hold usage can't overlap, but this keeps state consistent
        // (and notifies the previous target) if a stray extra start ever arrives before a stop.
        stop(senderId);

        bySenderId.put(senderId, new Entry(channelId, targetUserId));
        broadcast(WsEventType.WHISTLE_START, channelId, senderId, targetUserId);
    }

    public void stop(UUID senderId) {
        Entry entry = bySenderId.remove(senderId);
        if (entry == null) return;

        broadcast(WsEventType.WHISTLE_STOP, entry.channelId(), senderId, entry.targetUserId());
    }

    /**
     * Called from every place a user's voice presence ends (WebSocket disconnect, explicit
     * leave-voice, kick, leave-server) so a whistle never survives its sender or target
     * disappearing. Covers both roles: stops the user's own whistle if they were the sender, and
     * stops any other sender's whistle that had this user as the target.
     */
    public void clearForUser(UUID userId) {
        stop(userId);

        bySenderId.entrySet().stream()
                .filter(entry -> entry.getValue().targetUserId().equals(userId))
                .map(Map.Entry::getKey)
                .toList()
                .forEach(this::stop);
    }

    private void broadcast(WsEventType type, UUID channelId, UUID senderId, UUID targetUserId) {
        realtimeEventPublisher.broadcast(Set.of(senderId, targetUserId),
                new WsEvent(type, new WhistlePayload(channelId, senderId, targetUserId)));
    }
}
