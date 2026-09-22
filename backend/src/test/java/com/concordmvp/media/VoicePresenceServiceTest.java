package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.permissions.Permission;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.servers.Server;
import com.concordmvp.servers.ServerRepository;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VoicePresenceServiceTest {

    @Mock
    private ChannelService channelService;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    @Mock
    private ServerRepository serverRepository;

    @Mock
    private PermissionService permissionService;

    @Mock
    private MediaService mediaService;

    private VoicePresenceService voicePresenceService;

    @BeforeEach
    void setUp() {
        voicePresenceService = new VoicePresenceService(
                channelService, serverMemberRepository, serverRepository, userRepository,
                realtimeEventPublisher, permissionService, mediaService);
        // Default: the requester can see every voice channel. Tests that care about the filter
        // override this for one specific channel.
        lenient().when(permissionService.hasChannel(any(UUID.class), any(), eq(Permission.VIEW_CHANNEL)))
                .thenReturn(true);
    }

    private Channel channel(UUID id, UUID serverId, ChannelType type) {
        Channel channel = new Channel();
        channel.setId(id);
        channel.setServerId(serverId);
        channel.setName("lobby");
        channel.setType(type);
        return channel;
    }

    private User user(UUID id, String displayName) {
        User user = new User();
        user.setId(id);
        user.setUsername("someuser");
        user.setDisplayName(displayName);
        user.setEmail("someuser@example.test");
        return user;
    }

    private ServerMember member(UUID userId, UUID serverId) {
        ServerMember member = new ServerMember();
        member.setUserId(userId);
        member.setServerId(serverId);
        return member;
    }

    @Test
    void updatePresence_nonVoiceChannel_throwsBadRequest() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.TEXT));

        assertThatThrownBy(() -> voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void updatePresence_channelNotFound_propagatesResourceNotFound() {
        UUID channelId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId))
                .thenThrow(new ResourceNotFoundException("Channel not found: " + channelId));

        assertThatThrownBy(() -> voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updatePresence_notAMember_propagatesForbidden() {
        UUID channelId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId))
                .thenThrow(new ForbiddenException("Not a member of this server"));

        assertThatThrownBy(() -> voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void updatePresence_userNotFound_throwsResourceNotFound() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updatePresence_valid_storesEntry_andBroadcastsToServerMembers() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID otherMemberId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, "Felipe")));
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(
                member(userId, serverId), member(otherMemberId, serverId)));

        voicePresenceService.updatePresence(channelId, userId, true, false, true, false, false);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(userId, otherMemberId)), eventCaptor.capture());
        WsEvent event = eventCaptor.getValue();
        assertThat(event.type()).isEqualTo(WsEventType.VOICE_PRESENCE_UPDATE);
        VoicePresenceResponse payload = (VoicePresenceResponse) event.payload();
        assertThat(payload.serverId()).isEqualTo(serverId);
        assertThat(payload.channelId()).isEqualTo(channelId);
        assertThat(payload.user().id()).isEqualTo(userId);
        assertThat(payload.user().displayName()).isEqualTo("Felipe");
        assertThat(payload.muted()).isTrue();
        assertThat(payload.cameraOn()).isFalse();
        assertThat(payload.screenSharing()).isTrue();
        assertThat(payload.speaking()).isFalse();
        assertThat(payload.deafened()).isFalse();

        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);
        List<VoicePresenceResponse> current = voicePresenceService.getPresence(serverId, userId);
        assertThat(current).hasSize(1);
        assertThat(current.get(0)).isEqualTo(payload);
    }

    @Test
    void updatePresence_secondCallForSameUser_overwritesRatherThanDuplicates() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, "Felipe")));
        lenient().when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(member(userId, serverId)));

        voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false);
        voicePresenceService.updatePresence(channelId, userId, true, false, false, false, false);

        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);
        List<VoicePresenceResponse> current = voicePresenceService.getPresence(serverId, userId);
        assertThat(current).hasSize(1);
        assertThat(current.get(0).muted()).isTrue();
    }

    @Test
    void updatePresence_deafened_isIncludedInBroadcastAndSnapshot() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, "Felipe")));
        lenient().when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(member(userId, serverId)));

        voicePresenceService.updatePresence(channelId, userId, true, false, false, false, true);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(userId)), eventCaptor.capture());
        VoicePresenceResponse payload = (VoicePresenceResponse) eventCaptor.getValue().payload();
        assertThat(payload.deafened()).isTrue();

        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);
        List<VoicePresenceResponse> current = voicePresenceService.getPresence(serverId, userId);
        assertThat(current.get(0).deafened()).isTrue();
    }

    @Test
    void removePresence_absentUser_isNoOp() {
        voicePresenceService.removePresence(UUID.randomUUID());

        verify(realtimeEventPublisher, never()).broadcast(any(), any());
    }

    @Test
    void removePresence_presentUser_removesEntry_andBroadcastsLeave() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID otherMemberId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, "Felipe")));
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(
                member(userId, serverId), member(otherMemberId, serverId)));
        voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false);

        voicePresenceService.removePresence(userId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, times(2))
                .broadcast(eq(Set.of(userId, otherMemberId)), eventCaptor.capture());
        WsEvent leaveEvent = eventCaptor.getAllValues().get(1);
        assertThat(leaveEvent.type()).isEqualTo(WsEventType.VOICE_PRESENCE_LEAVE);
        VoicePresenceLeavePayload payload = (VoicePresenceLeavePayload) leaveEvent.payload();
        assertThat(payload.serverId()).isEqualTo(serverId);
        assertThat(payload.channelId()).isEqualTo(channelId);
        assertThat(payload.userId()).isEqualTo(userId);

        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);
        assertThat(voicePresenceService.getPresence(serverId, userId)).isEmpty();
    }

    @Test
    void getPresence_nonMember_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(false);

        assertThatThrownBy(() -> voicePresenceService.getPresence(serverId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void getPresence_filtersToRequestedServerOnly() {
        UUID serverId = UUID.randomUUID();
        UUID otherServerId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID otherChannelId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID otherServerUserId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(channelService.getChannel(otherChannelId, otherServerUserId))
                .thenReturn(channel(otherChannelId, otherServerId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, "Felipe")));
        when(userRepository.findById(otherServerUserId)).thenReturn(Optional.of(user(otherServerUserId, "Ana")));
        lenient().when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(member(userId, serverId)));
        lenient().when(serverMemberRepository.findByServerId(otherServerId))
                .thenReturn(List.of(member(otherServerUserId, otherServerId)));
        voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false);
        voicePresenceService.updatePresence(otherChannelId, otherServerUserId, false, false, false, false, false);
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);

        List<VoicePresenceResponse> current = voicePresenceService.getPresence(serverId, userId);

        assertThat(current).hasSize(1);
        assertThat(current.get(0).user().id()).isEqualTo(userId);
    }

    // --- DISCONNECT_MEMBERS replaces the old owner-only rule ---

    @Test
    void disconnectParticipant_withoutDisconnectMembers_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, requesterId)).thenReturn(voice);
        doThrow(new ForbiddenException("denied")).when(permissionService)
                .requireChannel(voice, requesterId, Permission.DISCONNECT_MEMBERS);

        assertThatThrownBy(() -> voicePresenceService.disconnectParticipant(channelId, UUID.randomUUID(), requesterId))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void disconnectParticipant_cannotDisconnectSomebodyWhoOutranksYou() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID moderatorId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        when(channelService.getChannel(channelId, moderatorId))
                .thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(permissionService.outranks(serverId, moderatorId, adminId)).thenReturn(false);

        assertThatThrownBy(() -> voicePresenceService.disconnectParticipant(channelId, adminId, moderatorId))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void disconnectParticipant_moderatorWithThePermission_kicksALowerRankedMember() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID moderatorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, targetId)).thenReturn(voice);
        when(channelService.getChannel(channelId, moderatorId)).thenReturn(voice);
        when(userRepository.findById(targetId)).thenReturn(Optional.of(user(targetId, "Alvo")));
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(member(moderatorId, serverId), member(targetId, serverId)));
        when(permissionService.outranks(serverId, moderatorId, targetId)).thenReturn(true);
        voicePresenceService.updatePresence(channelId, targetId, false, false, false, false, false);

        voicePresenceService.disconnectParticipant(channelId, targetId, moderatorId);

        ArgumentCaptor<WsEvent> events = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, times(3)).broadcast(any(), events.capture());
        assertThat(events.getAllValues()).extracting(WsEvent::type)
                .containsExactly(WsEventType.VOICE_PRESENCE_UPDATE, WsEventType.VOICE_KICK,
                        WsEventType.VOICE_PRESENCE_LEAVE);
    }

    @Test
    void disconnectParticipant_cannotTargetYourself() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.VOICE));

        assertThatThrownBy(() -> voicePresenceService.disconnectParticipant(channelId, requesterId, requesterId))
                .isInstanceOf(BadRequestException.class);
    }

    // --- presence is filtered by VIEW_CHANNEL ---

    @Test
    void getPresence_omitsParticipantsInChannelsTheRequesterCannotSee() {
        UUID serverId = UUID.randomUUID();
        UUID hiddenChannelId = UUID.randomUUID();
        UUID speakerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(hiddenChannelId, speakerId))
                .thenReturn(channel(hiddenChannelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(speakerId)).thenReturn(Optional.of(user(speakerId, "Secreto")));
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(member(speakerId, serverId)));
        voicePresenceService.updatePresence(hiddenChannelId, speakerId, false, false, false, false, false);

        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(true);
        when(permissionService.hasChannel(hiddenChannelId, requesterId, Permission.VIEW_CHANNEL)).thenReturn(false);

        assertThat(voicePresenceService.getPresence(serverId, requesterId)).isEmpty();
    }

    // --- disconnectFromServer ---

    @Test
    void disconnectFromServer_userConnectedInThisServer_removesLiveKitParticipant_andClearsPresence() {
        // Security audit A5: leaving a server must not leave the member talking in a voice room
        // whose join token stays valid for hours.
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, "Felipe")));
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(member(userId, serverId)));
        voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false);

        voicePresenceService.disconnectFromServer(serverId, userId);

        verify(mediaService).removeParticipant(channelId, userId);

        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);
        assertThat(voicePresenceService.getPresence(serverId, userId)).isEmpty();
    }

    @Test
    void disconnectFromServer_userNotInVoice_isNoOp() {
        voicePresenceService.disconnectFromServer(UUID.randomUUID(), UUID.randomUUID());

        verifyNoInteractions(mediaService);
    }

    @Test
    void disconnectFromServer_userInVoiceOnADifferentServer_isNoOp() {
        UUID channelId = UUID.randomUUID();
        UUID actualServerId = UUID.randomUUID();
        UUID otherServerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelService.getChannel(channelId, userId)).thenReturn(channel(channelId, actualServerId, ChannelType.VOICE));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user(userId, "Felipe")));
        lenient().when(serverMemberRepository.findByServerId(actualServerId)).thenReturn(List.of(member(userId, actualServerId)));
        voicePresenceService.updatePresence(channelId, userId, false, false, false, false, false);

        voicePresenceService.disconnectFromServer(otherServerId, userId);

        verifyNoInteractions(mediaService);
    }
}
