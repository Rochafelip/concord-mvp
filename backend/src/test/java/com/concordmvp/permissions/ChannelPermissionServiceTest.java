package com.concordmvp.permissions;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChannelPermissionServiceTest {

    @Mock private ChannelRepository channelRepository;
    @Mock private ChannelPermissionOverrideRepository overrideRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private ServerMemberRepository serverMemberRepository;
    @Mock private PermissionService permissionService;
    @Mock private RealtimeEventPublisher realtimeEventPublisher;

    private ChannelPermissionService channelPermissionService;

    private final UUID serverId = UUID.randomUUID();
    private final UUID channelId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();

    private Role moderator;

    @BeforeEach
    void setUp() {
        channelPermissionService = new ChannelPermissionService(channelRepository, overrideRepository,
                roleRepository, serverMemberRepository, permissionService, realtimeEventPublisher);

        Channel channel = new Channel();
        channel.setId(channelId);
        channel.setServerId(serverId);
        when(channelRepository.findById(channelId)).thenReturn(Optional.of(channel));

        moderator = new Role();
        moderator.setId(UUID.randomUUID());
        moderator.setServerId(serverId);
        moderator.setName("Moderador");
        moderator.setPosition(3);
        when(roleRepository.findById(moderator.getId())).thenReturn(Optional.of(moderator));

        ServerMember membership = new ServerMember();
        membership.setId(UUID.randomUUID());
        membership.setServerId(serverId);
        membership.setUserId(targetId);
        when(serverMemberRepository.findByServerIdAndUserId(serverId, targetId)).thenReturn(Optional.of(membership));

        when(overrideRepository.save(any(ChannelPermissionOverride.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_ROLES)).thenReturn(true);
        when(permissionService.serverPermissions(serverId, actorId)).thenReturn(Permission.ALL);
        when(permissionService.highestPosition(serverId, actorId)).thenReturn(10);
        when(permissionService.highestPosition(serverId, targetId)).thenReturn(0);
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(membership));
    }

    // ---------- writing overrides ----------

    @Test
    void createsARoleOverride() {
        ChannelPermissionOverride saved = channelPermissionService.upsertRoleOverride(channelId,
                moderator.getId(), Set.of(Permission.VIEW_CHANNEL), Set.of(Permission.SEND_MESSAGES), actorId);

        assertThat(saved.getChannelId()).isEqualTo(channelId);
        assertThat(saved.getRoleId()).isEqualTo(moderator.getId());
        assertThat(saved.getUserId()).isNull();
        assertThat(saved.getAllow()).isEqualTo(Permission.VIEW_CHANNEL.bit());
        assertThat(saved.getDeny()).isEqualTo(Permission.SEND_MESSAGES.bit());
    }

    @Test
    void replacesAnExistingRoleOverrideInsteadOfAddingASecondOne() {
        ChannelPermissionOverride existing =
                ChannelPermissionOverride.forRole(channelId, moderator.getId(), 0L, Permission.ALL);
        existing.setId(UUID.randomUUID());
        when(overrideRepository.findByChannelIdAndRoleId(channelId, moderator.getId()))
                .thenReturn(Optional.of(existing));

        ChannelPermissionOverride saved = channelPermissionService.upsertRoleOverride(channelId,
                moderator.getId(), Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId);

        assertThat(saved.getId()).isEqualTo(existing.getId());
        assertThat(saved.getAllow()).isEqualTo(Permission.VIEW_CHANNEL.bit());
        assertThat(saved.getDeny()).isZero();
    }

    @Test
    void createsAUserOverride() {
        ChannelPermissionOverride saved = channelPermissionService.upsertUserOverride(channelId,
                targetId, Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId);

        assertThat(saved.getUserId()).isEqualTo(targetId);
        assertThat(saved.getRoleId()).isNull();
    }

    @Test
    void anEmptyOverrideIsDeletedRatherThanStoredAsANoOpRow() {
        ChannelPermissionOverride existing =
                ChannelPermissionOverride.forRole(channelId, moderator.getId(), Permission.VIEW_CHANNEL.bit(), 0L);
        existing.setId(UUID.randomUUID());
        when(overrideRepository.findByChannelIdAndRoleId(channelId, moderator.getId()))
                .thenReturn(Optional.of(existing));

        ChannelPermissionOverride result = channelPermissionService.upsertRoleOverride(channelId,
                moderator.getId(), Set.of(), Set.of(), actorId);

        assertThat(result).isNull();
        verify(overrideRepository).delete(existing);
        verify(overrideRepository, never()).save(any());
    }

    @Test
    void anEmptyOverrideThatDoesNotExistYetIsSimplyNotCreated() {
        assertThat(channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(), Set.of(), actorId)).isNull();

        verify(overrideRepository, never()).save(any());
        verify(overrideRepository, never()).delete(any());
    }

    // ---------- validation ----------

    @Test
    void aPermissionCannotBeAllowedAndDeniedAtTheSameTime() {
        assertThatThrownBy(() -> channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(Permission.VIEW_CHANNEL), Set.of(Permission.VIEW_CHANNEL), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void aServerScopedPermissionCannotBeSetOnAChannel() {
        assertThatThrownBy(() -> channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(Permission.ADMINISTRATOR), Set.of(), actorId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ADMINISTRATOR");

        assertThatThrownBy(() -> channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(), Set.of(Permission.MANAGE_ROLES), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void cannotAllowAPermissionTheActorDoesNotHold() {
        when(permissionService.serverPermissions(serverId, actorId))
                .thenReturn(PermissionSet.toBitmask(Set.of(Permission.MANAGE_ROLES, Permission.VIEW_CHANNEL)));

        assertThatThrownBy(() -> channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(Permission.MANAGE_MESSAGES), Set.of(), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void denyingIsAllowedEvenForAPermissionTheActorDoesNotHold() {
        // Taking something away is never an escalation.
        when(permissionService.serverPermissions(serverId, actorId))
                .thenReturn(PermissionSet.toBitmask(Set.of(Permission.MANAGE_ROLES)));

        assertThat(channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(), Set.of(Permission.MANAGE_MESSAGES), actorId)).isNotNull();
    }

    // ---------- authorization ----------

    @Test
    void writingAnOverrideRequiresManageRoles() {
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_ROLES)).thenReturn(false);

        assertThatThrownBy(() -> channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cannotWriteAnOverrideForARoleAtOrAboveTheActorsRank() {
        when(permissionService.highestPosition(serverId, actorId)).thenReturn(3);

        assertThatThrownBy(() -> channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cannotWriteAnOverrideForAUserWhoOutranksTheActor() {
        when(permissionService.highestPosition(serverId, targetId)).thenReturn(10);

        assertThatThrownBy(() -> channelPermissionService.upsertUserOverride(channelId, targetId,
                Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cannotWriteAUserOverrideForSomebodyWhoIsNotAMember() {
        UUID outsider = UUID.randomUUID();
        when(serverMemberRepository.findByServerIdAndUserId(serverId, outsider)).thenReturn(Optional.empty());
        when(permissionService.highestPosition(serverId, outsider)).thenReturn(Integer.MIN_VALUE);

        assertThatThrownBy(() -> channelPermissionService.upsertUserOverride(channelId, outsider,
                Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void aRoleFromAnotherServerCannotBeOverriddenHere() {
        Role foreign = new Role();
        foreign.setId(UUID.randomUUID());
        foreign.setServerId(UUID.randomUUID());
        foreign.setPosition(1);
        when(roleRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> channelPermissionService.upsertRoleOverride(channelId, foreign.getId(),
                Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void anUnknownChannelIsNotFound() {
        UUID missing = UUID.randomUUID();
        when(channelRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> channelPermissionService.listOverrides(missing, actorId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------- reading and deleting ----------

    @Test
    void listingOverridesRequiresManageRolesOrManageChannels() {
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_ROLES)).thenReturn(false);
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_CHANNELS)).thenReturn(false);

        assertThatThrownBy(() -> channelPermissionService.listOverrides(channelId, actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void manageChannelsAloneIsEnoughToReadOverrides() {
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_ROLES)).thenReturn(false);
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_CHANNELS)).thenReturn(true);
        when(overrideRepository.findByChannelId(channelId)).thenReturn(List.of());

        assertThat(channelPermissionService.listOverrides(channelId, actorId)).isEmpty();
    }

    @Test
    void deletesAnOverride() {
        ChannelPermissionOverride existing =
                ChannelPermissionOverride.forRole(channelId, moderator.getId(), Permission.VIEW_CHANNEL.bit(), 0L);
        existing.setId(UUID.randomUUID());
        when(overrideRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        channelPermissionService.deleteOverride(channelId, existing.getId(), actorId);

        verify(overrideRepository).delete(existing);
    }

    @Test
    void anOverrideBelongingToAnotherChannelIsNotFound() {
        ChannelPermissionOverride other =
                ChannelPermissionOverride.forRole(UUID.randomUUID(), moderator.getId(), 0L, 0L);
        other.setId(UUID.randomUUID());
        when(overrideRepository.findById(other.getId())).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> channelPermissionService.deleteOverride(channelId, other.getId(), actorId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------- realtime ----------

    @Test
    void aRoleOverrideNotifiesTheWholeServerBecauseChannelVisibilityMayHaveShifted() {
        channelPermissionService.upsertRoleOverride(channelId, moderator.getId(),
                Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId);

        ArgumentCaptor<WsEvent> event = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(targetId)), event.capture());
        assertThat(event.getValue().type()).isEqualTo(WsEventType.PERMISSIONS_UPDATE);
    }

    @Test
    void aUserOverrideNotifiesOnlyThatUser() {
        channelPermissionService.upsertUserOverride(channelId, targetId,
                Set.of(Permission.VIEW_CHANNEL), Set.of(), actorId);

        verify(realtimeEventPublisher).broadcast(eq(Set.of(targetId)), any(WsEvent.class));
    }
}
