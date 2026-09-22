package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.media.dto.WhistlePayload;
import com.concordmvp.permissions.Permission;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhistleServiceTest {

    @Mock
    private ChannelService channelService;

    @Mock
    private PermissionService permissionService;

    @Mock
    private VoicePresenceService voicePresenceService;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    private WhistleService whistleService;

    private Channel channel(UUID id, UUID serverId, ChannelType type) {
        Channel channel = new Channel();
        channel.setId(id);
        channel.setServerId(serverId);
        channel.setName("lobby");
        channel.setType(type);
        return channel;
    }

    private void setUp() {
        whistleService = new WhistleService(channelService, permissionService, voicePresenceService,
                realtimeEventPublisher);
    }

    @Test
    void start_targetIsSelf_throwsBadRequest() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();

        assertThatThrownBy(() -> whistleService.start(channelId, senderId, senderId))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void start_nonVoiceChannel_throwsBadRequest() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        when(channelService.getChannel(channelId, senderId)).thenReturn(channel(channelId, serverId, ChannelType.TEXT));

        assertThatThrownBy(() -> whistleService.start(channelId, targetId, senderId))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void start_senderLacksSpeakPermission_propagatesForbidden() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        doThrow(new ForbiddenException("denied")).when(permissionService)
                .requireChannel(voice, senderId, Permission.SPEAK);

        assertThatThrownBy(() -> whistleService.start(channelId, targetId, senderId))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void start_senderNotConnectedToChannel_throwsResourceNotFound() {
        // A server member with SPEAK in the channel but who never actually joined this voice
        // channel (or is connected to a different one) must not be able to trigger a fake
        // "X is whistling to you" indicator on some other connected member via a raw WS frame.
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        when(voicePresenceService.isConnected(channelId, senderId)).thenReturn(false);

        assertThatThrownBy(() -> whistleService.start(channelId, targetId, senderId))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void start_targetNotConnectedToChannel_throwsResourceNotFound() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        when(voicePresenceService.isConnected(channelId, senderId)).thenReturn(true);
        when(voicePresenceService.isConnected(channelId, targetId)).thenReturn(false);

        assertThatThrownBy(() -> whistleService.start(channelId, targetId, senderId))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void start_valid_broadcastsWhistleStartToSenderAndTarget() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        when(voicePresenceService.isConnected(channelId, senderId)).thenReturn(true);
        when(voicePresenceService.isConnected(channelId, targetId)).thenReturn(true);

        whistleService.start(channelId, targetId, senderId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(senderId, targetId)), eventCaptor.capture());
        WsEvent event = eventCaptor.getValue();
        assertThat(event.type()).isEqualTo(WsEventType.WHISTLE_START);
        WhistlePayload payload = (WhistlePayload) event.payload();
        assertThat(payload.channelId()).isEqualTo(channelId);
        assertThat(payload.senderId()).isEqualTo(senderId);
        assertThat(payload.targetUserId()).isEqualTo(targetId);
    }

    @Test
    void start_whileAlreadyWhistlingToSomeoneElse_stopsPreviousBeforeStartingNew() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID firstTargetId = UUID.randomUUID();
        UUID secondTargetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        when(voicePresenceService.isConnected(channelId, senderId)).thenReturn(true);
        when(voicePresenceService.isConnected(channelId, firstTargetId)).thenReturn(true);
        when(voicePresenceService.isConnected(channelId, secondTargetId)).thenReturn(true);
        whistleService.start(channelId, firstTargetId, senderId);

        whistleService.start(channelId, secondTargetId, senderId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, times(3)).broadcast(any(), eventCaptor.capture());
        List<WsEvent> events = eventCaptor.getAllValues();
        assertThat(events).extracting(WsEvent::type)
                .containsExactly(WsEventType.WHISTLE_START, WsEventType.WHISTLE_STOP, WsEventType.WHISTLE_START);
        assertThat(((WhistlePayload) events.get(1).payload()).targetUserId()).isEqualTo(firstTargetId);
        assertThat(((WhistlePayload) events.get(2).payload()).targetUserId()).isEqualTo(secondTargetId);
    }

    @Test
    void stop_noActiveWhistle_isNoOp() {
        setUp();
        whistleService.stop(UUID.randomUUID());

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void stop_activeWhistle_broadcastsWhistleStopToSenderAndTarget_andClearsState() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        when(voicePresenceService.isConnected(channelId, senderId)).thenReturn(true);
        when(voicePresenceService.isConnected(channelId, targetId)).thenReturn(true);
        whistleService.start(channelId, targetId, senderId);

        whistleService.stop(senderId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, times(2)).broadcast(eq(Set.of(senderId, targetId)), eventCaptor.capture());
        WsEvent stopEvent = eventCaptor.getAllValues().get(1);
        assertThat(stopEvent.type()).isEqualTo(WsEventType.WHISTLE_STOP);
        assertThat(((WhistlePayload) stopEvent.payload()).targetUserId()).isEqualTo(targetId);

        // Calling stop again is a no-op: state was already cleared.
        whistleService.stop(senderId);
        verify(realtimeEventPublisher, times(2)).broadcast(eq(Set.of(senderId, targetId)), any());
    }

    @Test
    void clearForUser_senderWasWhistling_stopsIt() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        when(voicePresenceService.isConnected(channelId, senderId)).thenReturn(true);
        when(voicePresenceService.isConnected(channelId, targetId)).thenReturn(true);
        whistleService.start(channelId, targetId, senderId);

        whistleService.clearForUser(senderId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, times(2)).broadcast(eq(Set.of(senderId, targetId)), eventCaptor.capture());
        assertThat(eventCaptor.getAllValues().get(1).type()).isEqualTo(WsEventType.WHISTLE_STOP);
    }

    @Test
    void clearForUser_userWasTargetOfAnotherSendersWhistle_stopsThatWhistle() {
        setUp();
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, senderId)).thenReturn(voice);
        when(voicePresenceService.isConnected(channelId, senderId)).thenReturn(true);
        when(voicePresenceService.isConnected(channelId, targetId)).thenReturn(true);
        whistleService.start(channelId, targetId, senderId);

        whistleService.clearForUser(targetId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher, times(2)).broadcast(eq(Set.of(senderId, targetId)), eventCaptor.capture());
        assertThat(eventCaptor.getAllValues().get(1).type()).isEqualTo(WsEventType.WHISTLE_STOP);
    }

    @Test
    void clearForUser_userNotInvolvedInAnyWhistle_isNoOp() {
        setUp();
        whistleService.clearForUser(UUID.randomUUID());

        verifyNoInteractions(realtimeEventPublisher);
    }
}
