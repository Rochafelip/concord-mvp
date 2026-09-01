package com.concordmvp.servers;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.MessageRepository;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.dto.ServerMemberEventPayload;
import com.concordmvp.servers.dto.ServerOwnerChangePayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServerServiceTest {

    @Mock
    private ServerRepository serverRepository;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private ServerInviteRepository serverInviteRepository;

    @Mock
    private ChannelRepository channelRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    private ServerService serverService;

    @BeforeEach
    void setUp() {
        serverService = new ServerService(serverRepository, serverMemberRepository, serverInviteRepository, channelRepository, messageRepository, realtimeEventPublisher);
    }

    /** Mimics JPA assigning an id on save/persist for a {@link Server} that doesn't already have one. */
    private void stubServerSaveAssignsId() {
        when(serverRepository.save(any(Server.class))).thenAnswer(invocation -> {
            Server server = invocation.getArgument(0);
            if (server.getId() == null) {
                server.setId(UUID.randomUUID());
            }
            return server;
        });
    }

    /** Mimics JPA assigning an id on save/persist for a {@link ServerMember} that doesn't already have one. */
    private void stubMemberSaveAssignsId() {
        when(serverMemberRepository.save(any(ServerMember.class))).thenAnswer(invocation -> {
            ServerMember member = invocation.getArgument(0);
            if (member.getId() == null) {
                member.setId(UUID.randomUUID());
            }
            return member;
        });
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

    // --- createServer ---

    @Test
    void createServer_savesServerAndOwnerMembership() {
        UUID ownerId = UUID.randomUUID();
        stubServerSaveAssignsId();
        stubMemberSaveAssignsId();

        Server result = serverService.createServer("My Server", ownerId);

        assertThat(result.getName()).isEqualTo("My Server");
        assertThat(result.getOwnerId()).isEqualTo(ownerId);

        verify(serverRepository).save(any(Server.class));

        ArgumentCaptor<ServerMember> memberCaptor = ArgumentCaptor.forClass(ServerMember.class);
        verify(serverMemberRepository).save(memberCaptor.capture());
        assertThat(memberCaptor.getValue().getUserId()).isEqualTo(ownerId);
        assertThat(memberCaptor.getValue().getServerId()).isEqualTo(result.getId());
    }

    // --- getServer / listMembers access control ---

    @Test
    void getServer_nonMember_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, UUID.randomUUID())));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(false);

        assertThatThrownBy(() -> serverService.getServer(serverId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void listMembers_nonMember_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, UUID.randomUUID())));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)).thenReturn(false);

        assertThatThrownBy(() -> serverService.listMembers(serverId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    // --- owner-only actions ---

    @Test
    void deleteServer_nonOwner_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));

        assertThatThrownBy(() -> serverService.deleteServer(serverId, requesterId))
                .isInstanceOf(ForbiddenException.class);

        verifyNoInteractions(realtimeEventPublisher);
        verify(serverRepository, never()).delete(any());
    }

    @Test
    void transferOwnership_nonOwner_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));

        assertThatThrownBy(() -> serverService.transferOwnership(serverId, UUID.randomUUID(), requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void regenerateInvite_nonOwner_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));

        assertThatThrownBy(() -> serverService.regenerateInvite(serverId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void getOrCreateInvite_nonOwner_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));

        assertThatThrownBy(() -> serverService.getOrCreateInvite(serverId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void regenerateInvite_existingInvite_updatesSameRow_notNewRow() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID existingInviteId = UUID.randomUUID();
        ServerInvite existingInvite = new ServerInvite();
        existingInvite.setId(existingInviteId);
        existingInvite.setServerId(serverId);
        existingInvite.setCode("oldcode1");

        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));
        when(serverInviteRepository.findByServerId(serverId)).thenReturn(Optional.of(existingInvite));
        when(serverInviteRepository.save(any(ServerInvite.class))).thenAnswer(invocation -> invocation.getArgument(0));

        serverService.regenerateInvite(serverId, ownerId);

        ArgumentCaptor<ServerInvite> inviteCaptor = ArgumentCaptor.forClass(ServerInvite.class);
        verify(serverInviteRepository).save(inviteCaptor.capture());
        // D10: regeneration is an UPDATE (server_invites has UNIQUE(server_id)) — same row, new code.
        assertThat(inviteCaptor.getValue().getId()).isEqualTo(existingInviteId);
        assertThat(inviteCaptor.getValue().getCode()).isNotEqualTo("oldcode1");
    }

    // --- leaveServer ---

    @Test
    void leaveServer_owner_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));

        assertThatThrownBy(() -> serverService.leaveServer(serverId, ownerId))
                .isInstanceOf(ForbiddenException.class);

        verify(serverMemberRepository, never()).delete(any());
        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void leaveServer_notAMember_throwsResourceNotFound() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));
        when(serverMemberRepository.findByServerIdAndUserId(serverId, requesterId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> serverService.leaveServer(serverId, requesterId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void leaveServer_nonOwnerMember_succeeds_andBroadcastsLeave() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID leavingUserId = UUID.randomUUID();
        ServerMember membership = member(serverId, leavingUserId);

        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));
        when(serverMemberRepository.findByServerIdAndUserId(serverId, leavingUserId)).thenReturn(Optional.of(membership));
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(member(serverId, ownerId)));

        serverService.leaveServer(serverId, leavingUserId);

        verify(serverMemberRepository).delete(membership);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(ownerId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.SERVER_MEMBER_LEAVE);
        assertThat(eventCaptor.getValue().payload()).isEqualTo(new ServerMemberEventPayload(serverId, leavingUserId));
    }

    // --- transferOwnership ---

    @Test
    void transferOwnership_toNonMember_throwsBadRequest() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID newOwnerId = UUID.randomUUID();
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server(serverId, ownerId)));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, newOwnerId)).thenReturn(false);

        assertThatThrownBy(() -> serverService.transferOwnership(serverId, newOwnerId, ownerId))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void transferOwnership_toExistingMember_succeeds_andBroadcastsOwnerChange() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID newOwnerId = UUID.randomUUID();
        Server server = server(serverId, ownerId);

        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, newOwnerId)).thenReturn(true);
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(member(serverId, ownerId), member(serverId, newOwnerId)));
        when(serverRepository.save(server)).thenReturn(server);

        Server result = serverService.transferOwnership(serverId, newOwnerId, ownerId);

        assertThat(result.getOwnerId()).isEqualTo(newOwnerId);
        verify(serverRepository).save(server);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(ownerId, newOwnerId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.SERVER_OWNER_CHANGE);
        assertThat(eventCaptor.getValue().payload()).isEqualTo(new ServerOwnerChangePayload(serverId, newOwnerId));
    }

    // --- deleteServer ---

    @Test
    void deleteServer_broadcastsBeforeDeleting_andDeletesInOrder() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID otherMemberId = UUID.randomUUID();
        Server server = server(serverId, ownerId);
        ServerMember ownerMembership = member(serverId, ownerId);
        ServerMember otherMembership = member(serverId, otherMemberId);
        ServerInvite invite = new ServerInvite();
        invite.setId(UUID.randomUUID());
        invite.setServerId(serverId);
        invite.setCode("abc123");
        UUID channelId1 = UUID.randomUUID();
        UUID channelId2 = UUID.randomUUID();
        Channel channel1 = new Channel();
        channel1.setId(channelId1);
        channel1.setServerId(serverId);
        Channel channel2 = new Channel();
        channel2.setId(channelId2);
        channel2.setServerId(serverId);

        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server));
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(ownerMembership, otherMembership));
        when(serverInviteRepository.findByServerId(serverId)).thenReturn(Optional.of(invite));
        when(channelRepository.findByServerId(serverId)).thenReturn(List.of(channel1, channel2));

        // Sanity: no deletion has happened by the time broadcast fires.
        doAnswer(invocation -> {
            verify(messageRepository, never()).deleteByChannelIdIn(any());
            verify(channelRepository, never()).deleteByServerId(any());
            verify(serverInviteRepository, never()).delete(any());
            verify(serverMemberRepository, never()).deleteAll(anySet());
            verify(serverMemberRepository, never()).delete(any());
            verify(serverRepository, never()).delete(any());
            return null;
        }).when(realtimeEventPublisher).broadcast(anySet(), any(WsEvent.class));

        serverService.deleteServer(serverId, ownerId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(ownerId, otherMemberId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.SERVER_DELETE);

        verify(messageRepository).deleteByChannelIdIn(List.of(channelId1, channelId2));

        // Canonical cascade order (docs/DECISIONS.md D11): messages -> channels -> invite -> members -> server.
        InOrder inOrder = inOrder(messageRepository, channelRepository, serverInviteRepository, serverMemberRepository, serverRepository);
        inOrder.verify(messageRepository).deleteByChannelIdIn(any());
        inOrder.verify(channelRepository).deleteByServerId(serverId);
        inOrder.verify(serverInviteRepository).delete(invite);
        inOrder.verify(serverMemberRepository).deleteAll(any());
        inOrder.verify(serverRepository).delete(server);
    }

    // --- joinServer ---

    @Test
    void joinServer_invalidCode_throwsResourceNotFound() {
        when(serverInviteRepository.findByCode("bad-code")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> serverService.joinServer("bad-code", UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);

        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void joinServer_alreadyMember_isIdempotent_noDuplicateNoBroadcast() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        ServerInvite invite = new ServerInvite();
        invite.setId(UUID.randomUUID());
        invite.setServerId(serverId);
        invite.setCode("code123");
        Server server = server(serverId, ownerId);

        when(serverInviteRepository.findByCode("code123")).thenReturn(Optional.of(invite));
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(true);

        Server result = serverService.joinServer("code123", userId);

        assertThat(result).isSameAs(server);
        verify(serverMemberRepository, never()).save(any());
        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void joinServer_fresh_createsMembership_andBroadcastsJoin() {
        UUID serverId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        ServerInvite invite = new ServerInvite();
        invite.setId(UUID.randomUUID());
        invite.setServerId(serverId);
        invite.setCode("code123");
        Server server = server(serverId, ownerId);

        when(serverInviteRepository.findByCode("code123")).thenReturn(Optional.of(invite));
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server));
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, userId)).thenReturn(false);
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(member(serverId, ownerId), member(serverId, userId)));
        stubMemberSaveAssignsId();

        Server result = serverService.joinServer("code123", userId);

        assertThat(result).isSameAs(server);

        ArgumentCaptor<ServerMember> memberCaptor = ArgumentCaptor.forClass(ServerMember.class);
        verify(serverMemberRepository).save(memberCaptor.capture());
        assertThat(memberCaptor.getValue().getUserId()).isEqualTo(userId);
        assertThat(memberCaptor.getValue().getServerId()).isEqualTo(serverId);

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(ownerId, userId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.SERVER_MEMBER_JOIN);
        assertThat(eventCaptor.getValue().payload()).isEqualTo(new ServerMemberEventPayload(serverId, userId));
    }
}
