package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.realtime.dto.ChannelReadPayload;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChannelReadStateServiceTest {

    @Mock private ChannelReadStateRepository channelReadStateRepository;
    @Mock private ChannelRepository channelRepository;
    @Mock private ServerMemberRepository serverMemberRepository;
    @Mock private MessageRepository messageRepository;
    @Mock private RealtimeEventPublisher realtimeEventPublisher;
    @Mock private PermissionService permissionService;

    private ChannelReadStateService channelReadStateService;

    @BeforeEach
    void setUp() {
        channelReadStateService = new ChannelReadStateService(channelReadStateRepository, channelRepository,
                serverMemberRepository, messageRepository, realtimeEventPublisher, permissionService);
        // By default, visibility matches plain server membership — individual tests narrow this
        // down to prove a broadcast is filtered when it should be.
        when(permissionService.visibleMemberIds(any(), any())).thenAnswer(invocation -> invocation.getArgument(1));
    }

    private Channel channel(UUID id, UUID serverId) {
        Channel channel = new Channel();
        channel.setId(id);
        channel.setServerId(serverId);
        return channel;
    }

    private ServerMember member(UUID serverId, UUID userId) {
        ServerMember member = new ServerMember();
        member.setId(UUID.randomUUID());
        member.setServerId(serverId);
        member.setUserId(userId);
        return member;
    }

    @Test
    void markChannelAsRead_broadcastsToEveryMemberWhoCanSeeTheChannel() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID otherMemberId = UUID.randomUUID();
        Channel target = channel(channelId, serverId);
        when(channelRepository.findById(channelId)).thenReturn(Optional.of(target));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(member(serverId, userId), member(serverId, otherMemberId)));

        channelReadStateService.markChannelAsRead(userId, channelId, null);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(userId, otherMemberId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.CHANNEL_READ);
        assertThat(eventCaptor.getValue().payload()).isInstanceOf(ChannelReadPayload.class);
    }

    @Test
    void markChannelAsRead_memberWithoutViewChannel_doesNotReceiveTheBroadcast() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID hiddenMemberId = UUID.randomUUID();
        Channel target = channel(channelId, serverId);
        when(channelRepository.findById(channelId)).thenReturn(Optional.of(target));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(member(serverId, userId), member(serverId, hiddenMemberId)));
        // hiddenMemberId has no VIEW_CHANNEL on this channel, so it must not learn that userId
        // read it, or how many unread messages remain.
        when(permissionService.visibleMemberIds(eq(target), eq(Set.of(userId, hiddenMemberId))))
                .thenReturn(Set.of(userId));

        channelReadStateService.markChannelAsRead(userId, channelId, null);

        verify(realtimeEventPublisher).broadcast(eq(Set.of(userId)), any(WsEvent.class));
    }

    @Test
    void markChannelAsRead_requesterNotAMemberOfTheChannelsServer_doesNotBroadcast() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(channelRepository.findById(channelId)).thenReturn(Optional.of(channel(channelId, serverId)));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(false);

        channelReadStateService.markChannelAsRead(userId, channelId, null);

        verifyNoInteractions(realtimeEventPublisher);
    }
}
