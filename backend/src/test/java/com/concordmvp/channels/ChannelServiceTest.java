package com.concordmvp.channels;

import com.concordmvp.channels.dto.ChannelResponse;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.Server;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.servers.ServerRepository;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChannelServiceTest {

    @Mock
    private ChannelRepository channelRepository;

    @Mock
    private ServerRepository serverRepository;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    private ChannelService channelService;

    @BeforeEach
    void setUp() {
        channelService = new ChannelService(channelRepository, serverRepository, serverMemberRepository, realtimeEventPublisher);
    }

    private Server server(UUID id, UUID ownerId) {
        Server server = new Server();
        server.setId(id);
        server.setName("Test Server");
        server.setOwnerId(ownerId);
        return server;
    }

    private ServerMember member(UUID serverId, UUID userId) {
        ServerMember member = new ServerMember();
        member.setId(UUID.randomUUID());
        member.setServerId(serverId);
        member.setUserId(userId);
        return member;
    }

    private Channel channel(UUID id, UUID serverId) {
        Channel channel = new Channel();
        channel.setId(id);
        channel.setServerId(serverId);
        channel.setName("general");
        channel.setType(ChannelType.TEXT);
        return channel;
    }

    /** Mimics JPA assigning an id on save/persist for a {@link Channel} that doesn't already have one. */
    private void stubChannelSaveAssignsId() {
        when(channelRepository.save(any(Channel.class))).thenAnswer(invocation -> {
            Channel channel = invocation.getArgument(0);
            if (channel.getId() == null) {
                channel.setId(UUID.randomUUID());
            }
            return channel;
        });
    }

    // --- createChannel ---

    @Test
    void createChannel_serverNotFound_throwsResourceNotFound() {
        UUID serverId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> channelService.createChannel(serverId, "general", ChannelType.TEXT, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(realtimeEventPublisher);
        verify(channelRepository, never()).save(any());
    }

    @Test
    void createChannel_nonOwner_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));

        assertThatThrownBy(() -> channelService.createChannel(serverId, "general", ChannelType.TEXT, requesterId))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(realtimeEventPublisher);
        verify(channelRepository, never()).save(any());
    }

    @Test
    void createChannel_onboardingType_throwsBadRequest_evenForOwner() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();

        assertThatThrownBy(() -> channelService.createChannel(serverId, "onboarding", ChannelType.ONBOARDING, ownerId))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(realtimeEventPublisher);
        verify(channelRepository, never()).save(any());
    }

    @Test
    void createChannel_owner_succeeds_savesChannel_andBroadcastsToAllMembers() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID otherMemberId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(member(serverId, ownerId), member(serverId, otherMemberId)));
        stubChannelSaveAssignsId();

        Channel result = channelService.createChannel(serverId, "general", ChannelType.TEXT, ownerId);

        assertThat(result.getName()).isEqualTo("general");
        assertThat(result.getType()).isEqualTo(ChannelType.TEXT);
        assertThat(result.getServerId()).isEqualTo(serverId);

        ArgumentCaptor<Channel> channelCaptor = ArgumentCaptor.forClass(Channel.class);
        verify(channelRepository).save(channelCaptor.capture());
        assertThat(channelCaptor.getValue().getServerId()).isEqualTo(serverId);
        assertThat(channelCaptor.getValue().getName()).isEqualTo("general");
        assertThat(channelCaptor.getValue().getType()).isEqualTo(ChannelType.TEXT);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(ownerId, otherMemberId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.CHANNEL_CREATE);
        assertThat(eventCaptor.getValue().payload()).isInstanceOf(ChannelResponse.class);
        ChannelResponse payload = (ChannelResponse) eventCaptor.getValue().payload();
        assertThat(payload.id()).isEqualTo(result.getId());
        assertThat(payload.serverId()).isEqualTo(serverId);
        assertThat(payload.name()).isEqualTo("general");
        assertThat(payload.type()).isEqualTo(ChannelType.TEXT);
    }

    // --- listChannels ---

    @Test
    void listChannels_serverNotFound_throwsResourceNotFound() {
        UUID serverId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> channelService.listChannels(serverId, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void listChannels_nonMember_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, UUID.randomUUID())));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(false);

        assertThatThrownBy(() -> channelService.listChannels(serverId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void listChannels_member_succeeds() {
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, UUID.randomUUID())));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(true);
        when(channelRepository.findByServerId(serverId)).thenReturn(List.of(channel(channelId, serverId)));

        List<Channel> result = channelService.listChannels(serverId, requesterId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(channelId);
    }

    // --- getChannel ---

    @Test
    void getChannel_unknownChannel_throwsResourceNotFound() {
        UUID channelId = UUID.randomUUID();
        when(channelRepository.findById(channelId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> channelService.getChannel(channelId, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getChannel_nonMember_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelRepository.findById(channelId)).thenReturn(Optional.of(channel(channelId, serverId)));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(false);

        assertThatThrownBy(() -> channelService.getChannel(channelId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void getChannel_member_succeeds() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelRepository.findById(channelId)).thenReturn(Optional.of(channel(channelId, serverId)));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(true);

        Channel result = channelService.getChannel(channelId, requesterId);

        assertThat(result.getId()).isEqualTo(channelId);
    }
}
