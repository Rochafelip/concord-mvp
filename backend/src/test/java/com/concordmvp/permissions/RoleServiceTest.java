package com.concordmvp.permissions;

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
class RoleServiceTest {

    @Mock private RoleRepository roleRepository;
    @Mock private MemberRoleRepository memberRoleRepository;
    @Mock private ChannelPermissionOverrideRepository overrideRepository;
    @Mock private ServerMemberRepository serverMemberRepository;
    @Mock private PermissionService permissionService;
    @Mock private RealtimeEventPublisher realtimeEventPublisher;

    private RoleService roleService;

    private final UUID serverId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();
    private final UUID targetMembershipId = UUID.randomUUID();

    private Role everyone;
    private Role moderator;

    @BeforeEach
    void setUp() {
        roleService = new RoleService(roleRepository, memberRoleRepository, overrideRepository,
                serverMemberRepository, permissionService, realtimeEventPublisher);

        everyone = role("@everyone", 0, Permission.EVERYONE_DEFAULT);
        everyone.setEveryone(true);
        moderator = role("Moderador", 3, bits(Permission.MANAGE_MESSAGES));

        when(roleRepository.findById(everyone.getId())).thenReturn(Optional.of(everyone));
        when(roleRepository.findById(moderator.getId())).thenReturn(Optional.of(moderator));
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ServerMember targetMembership = new ServerMember();
        targetMembership.setId(targetMembershipId);
        targetMembership.setServerId(serverId);
        targetMembership.setUserId(targetId);
        when(serverMemberRepository.findByServerIdAndUserId(serverId, targetId))
                .thenReturn(Optional.of(targetMembership));
        when(serverMemberRepository.findByServerId(serverId)).thenReturn(List.of(targetMembership));

        // By default the actor is a high-ranking manager who holds every permission.
        actorIsManagerAtPosition(10);
        when(permissionService.serverPermissions(eq(serverId), eq(actorId))).thenReturn(Permission.ALL);
        when(permissionService.highestPosition(serverId, targetId)).thenReturn(0);
    }

    // ---------- helpers ----------

    private Role role(String name, int position, long permissions) {
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setServerId(serverId);
        role.setName(name);
        role.setPosition(position);
        role.setPermissions(permissions);
        return role;
    }

    private void actorIsManagerAtPosition(int position) {
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_ROLES)).thenReturn(true);
        when(permissionService.highestPosition(serverId, actorId)).thenReturn(position);
    }

    private static long bits(Permission... permissions) {
        return PermissionSet.toBitmask(Set.of(permissions));
    }

    private static RoleDraft draft(String name, Integer position, Permission... permissions) {
        return new RoleDraft(name, null, null, position, Set.of(permissions));
    }

    // ---------- create ----------

    @Test
    void createsARoleBelowTheActor() {
        Role created = roleService.createRole(serverId, draft("Dev", 4, Permission.MANAGE_CHANNELS), actorId);

        assertThat(created.getName()).isEqualTo("Dev");
        assertThat(created.getPosition()).isEqualTo(4);
        assertThat(created.getPermissions()).isEqualTo(bits(Permission.MANAGE_CHANNELS));
        assertThat(created.isEveryone()).isFalse();
    }

    @Test
    void aRoleWithoutAnExplicitPositionStartsAtOneJustAboveEveryone() {
        Role created = roleService.createRole(serverId, draft("Dev", null), actorId);

        assertThat(created.getPosition()).isEqualTo(1);
    }

    @Test
    void creatingRequiresManageRoles() {
        when(permissionService.hasServer(serverId, actorId, Permission.MANAGE_ROLES)).thenReturn(false);

        assertThatThrownBy(() -> roleService.createRole(serverId, draft("Dev", 1), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cannotCreateARoleAtOrAboveTheActorsOwnRank() {
        actorIsManagerAtPosition(5);

        assertThatThrownBy(() -> roleService.createRole(serverId, draft("Rival", 5), actorId))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> roleService.createRole(serverId, draft("Superior", 6), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void anActorRankedZeroCannotCreateAnyRoleAtAllBecauseNoPositionIsBelowIt() {
        // Happens when @everyone itself was given MANAGE_ROLES. There is no valid position under 0,
        // so the grant is inert by design — MANAGE_ROLES belongs on a role above @everyone.
        actorIsManagerAtPosition(0);

        assertThatThrownBy(() -> roleService.createRole(serverId, draft("Dev", null), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cannotGrantAPermissionTheActorDoesNotHaveItself() {
        when(permissionService.serverPermissions(serverId, actorId))
                .thenReturn(bits(Permission.MANAGE_ROLES, Permission.VIEW_CHANNEL));

        assertThatThrownBy(() -> roleService.createRole(serverId, draft("Dev", 1, Permission.BAN_MEMBERS), actorId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("BAN_MEMBERS");
    }

    @Test
    void grantingAPermissionTheActorDoesHaveIsFine() {
        when(permissionService.serverPermissions(serverId, actorId))
                .thenReturn(bits(Permission.MANAGE_ROLES, Permission.BAN_MEMBERS));

        Role created = roleService.createRole(serverId, draft("Dev", 1, Permission.BAN_MEMBERS), actorId);

        assertThat(PermissionSet.has(created.getPermissions(), Permission.BAN_MEMBERS)).isTrue();
    }

    @Test
    void aRoleCannotBeNamedLikeTheBuiltInEveryone() {
        assertThatThrownBy(() -> roleService.createRole(serverId, draft("@everyone", 1), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void aRoleNameCannotBeBlank() {
        assertThatThrownBy(() -> roleService.createRole(serverId, draft("   ", 1), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void aRoleColorMustBeAHexTriplet() {
        RoleDraft bad = new RoleDraft("Dev", null, "vermelho", 1, Set.of());

        assertThatThrownBy(() -> roleService.createRole(serverId, bad, actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void aValidColorIsKept() {
        RoleDraft withColor = new RoleDraft("Dev", null, "#E4572E", 1, Set.of());

        assertThat(roleService.createRole(serverId, withColor, actorId).getColor()).isEqualTo("#E4572E");
    }

    // ---------- update ----------

    @Test
    void updatesARoleBelowTheActor() {
        Role updated = roleService.updateRole(moderator.getId(),
                draft("Moderação", null, Permission.MANAGE_MESSAGES, Permission.KICK_MEMBERS), actorId);

        assertThat(updated.getName()).isEqualTo("Moderação");
        assertThat(updated.getPermissions()).isEqualTo(bits(Permission.MANAGE_MESSAGES, Permission.KICK_MEMBERS));
    }

    @Test
    void cannotUpdateARoleAtOrAboveTheActorsOwnRank() {
        actorIsManagerAtPosition(3);

        assertThatThrownBy(() -> roleService.updateRole(moderator.getId(), draft("Nope", null), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void everyonesPermissionsCanBeEditedBecauseThatIsHowServerDefaultsAreSet() {
        Role updated = roleService.updateRole(everyone.getId(),
                new RoleDraft(null, null, null, null, Set.of(Permission.VIEW_CHANNEL)), actorId);

        assertThat(updated.getPermissions()).isEqualTo(bits(Permission.VIEW_CHANNEL));
    }

    @Test
    void everyoneCannotBeRenamed() {
        assertThatThrownBy(() -> roleService.updateRole(everyone.getId(), draft("Galera", null), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void everyoneCannotBeMovedOffPositionZero() {
        assertThatThrownBy(() -> roleService.updateRole(everyone.getId(),
                new RoleDraft(null, null, null, 5, null), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void nullFieldsInAnUpdateLeaveTheExistingValuesAlone() {
        Role updated = roleService.updateRole(moderator.getId(),
                new RoleDraft(null, null, null, null, null), actorId);

        assertThat(updated.getName()).isEqualTo("Moderador");
        assertThat(updated.getPermissions()).isEqualTo(bits(Permission.MANAGE_MESSAGES));
        assertThat(updated.getPosition()).isEqualTo(3);
    }

    @Test
    void anUpdateCannotRaiseARoleToOrAboveTheActorsRank() {
        actorIsManagerAtPosition(5);

        assertThatThrownBy(() -> roleService.updateRole(moderator.getId(),
                new RoleDraft(null, null, null, 5, null), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void anUpdateCannotGrantAPermissionTheActorLacks() {
        when(permissionService.serverPermissions(serverId, actorId))
                .thenReturn(bits(Permission.MANAGE_ROLES, Permission.MANAGE_MESSAGES));

        assertThatThrownBy(() -> roleService.updateRole(moderator.getId(),
                draft(null, null, Permission.ADMINISTRATOR), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void updatingAnUnknownRoleIsNotFound() {
        UUID missing = UUID.randomUUID();
        when(roleRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> roleService.updateRole(missing, draft("x", null), actorId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------- delete ----------

    @Test
    void deletesARoleAlongWithItsAssignmentsAndOverrides() {
        roleService.deleteRole(moderator.getId(), actorId);

        verify(memberRoleRepository).deleteByRoleId(moderator.getId());
        verify(overrideRepository).deleteByRoleId(moderator.getId());
        verify(roleRepository).delete(moderator);
    }

    @Test
    void everyoneCannotBeDeleted() {
        assertThatThrownBy(() -> roleService.deleteRole(everyone.getId(), actorId))
                .isInstanceOf(BadRequestException.class);
        verify(roleRepository, never()).delete(any());
    }

    @Test
    void cannotDeleteARoleAtOrAboveTheActorsOwnRank() {
        actorIsManagerAtPosition(3);

        assertThatThrownBy(() -> roleService.deleteRole(moderator.getId(), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    // ---------- assignment ----------

    @Test
    void assignsARoleToAMember() {
        roleService.assignRole(serverId, targetId, moderator.getId(), actorId);

        ArgumentCaptor<MemberRole> captor = ArgumentCaptor.forClass(MemberRole.class);
        verify(memberRoleRepository).save(captor.capture());
        assertThat(captor.getValue().getServerMemberId()).isEqualTo(targetMembershipId);
        assertThat(captor.getValue().getRoleId()).isEqualTo(moderator.getId());
    }

    @Test
    void assigningAnAlreadyHeldRoleIsANoOp() {
        when(memberRoleRepository.existsByServerMemberIdAndRoleId(targetMembershipId, moderator.getId()))
                .thenReturn(true);

        roleService.assignRole(serverId, targetId, moderator.getId(), actorId);

        verify(memberRoleRepository, never()).save(any());
    }

    @Test
    void cannotAssignARoleAtOrAboveTheActorsOwnRank() {
        actorIsManagerAtPosition(3);

        assertThatThrownBy(() -> roleService.assignRole(serverId, targetId, moderator.getId(), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cannotChangeTheRolesOfSomebodyWhoOutranksYou() {
        when(permissionService.highestPosition(serverId, targetId)).thenReturn(10);

        assertThatThrownBy(() -> roleService.assignRole(serverId, targetId, moderator.getId(), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cannotAssignARoleToSomebodyWhoIsNotAMember() {
        UUID outsider = UUID.randomUUID();
        when(serverMemberRepository.findByServerIdAndUserId(serverId, outsider)).thenReturn(Optional.empty());
        when(permissionService.highestPosition(serverId, outsider)).thenReturn(Integer.MIN_VALUE);

        assertThatThrownBy(() -> roleService.assignRole(serverId, outsider, moderator.getId(), actorId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void everyoneCannotBeAssignedByHandBecauseItAlreadyAppliesToAllMembers() {
        assertThatThrownBy(() -> roleService.assignRole(serverId, targetId, everyone.getId(), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void removesARoleFromAMember() {
        when(memberRoleRepository.existsByServerMemberIdAndRoleId(targetMembershipId, moderator.getId()))
                .thenReturn(true);

        roleService.unassignRole(serverId, targetId, moderator.getId(), actorId);

        verify(memberRoleRepository).deleteById(new MemberRole.Key(targetMembershipId, moderator.getId()));
    }

    @Test
    void aRoleFromAnotherServerCannotBeAssigned() {
        Role foreign = role("Intruso", 1, 0L);
        foreign.setServerId(UUID.randomUUID());
        when(roleRepository.findById(foreign.getId())).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> roleService.assignRole(serverId, targetId, foreign.getId(), actorId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------- reordering ----------

    @Test
    void reordersRolesInOneBatch() {
        Role dev = role("Dev", 1, 0L);
        when(roleRepository.findById(dev.getId())).thenReturn(Optional.of(dev));

        roleService.updatePositions(serverId,
                List.of(new RolePosition(moderator.getId(), 1), new RolePosition(dev.getId(), 2)), actorId);

        assertThat(moderator.getPosition()).isEqualTo(1);
        assertThat(dev.getPosition()).isEqualTo(2);
    }

    @Test
    void reorderingCannotPushARoleToOrAboveTheActorsRank() {
        actorIsManagerAtPosition(5);

        assertThatThrownBy(() -> roleService.updatePositions(serverId,
                List.of(new RolePosition(moderator.getId(), 5)), actorId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void reorderingCannotMoveEveryone() {
        assertThatThrownBy(() -> roleService.updatePositions(serverId,
                List.of(new RolePosition(everyone.getId(), 4)), actorId))
                .isInstanceOf(BadRequestException.class);
    }

    // ---------- bootstrapping ----------

    @Test
    void createsTheEveryoneRoleForANewServerWithTheSameDefaultsAsTheMigration() {
        UUID freshServerId = UUID.randomUUID();

        Role created = roleService.createEveryoneRole(freshServerId);

        assertThat(created.isEveryone()).isTrue();
        assertThat(created.getName()).isEqualTo("@everyone");
        assertThat(created.getPosition()).isZero();
        assertThat(created.getPermissions()).isEqualTo(Permission.EVERYONE_DEFAULT);
    }

    // ---------- realtime ----------

    @Test
    void editingEveryoneNotifiesTheWholeServer() {
        roleService.updateRole(everyone.getId(),
                new RoleDraft(null, null, null, null, Set.of(Permission.VIEW_CHANNEL)), actorId);

        ArgumentCaptor<WsEvent> event = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(targetId)), event.capture());
        assertThat(event.getValue().type()).isEqualTo(WsEventType.PERMISSIONS_UPDATE);
    }

    @Test
    void editingANormalRoleNotifiesOnlyItsHolders() {
        when(memberRoleRepository.findUserIdsByRoleId(moderator.getId())).thenReturn(List.of(targetId));

        roleService.updateRole(moderator.getId(), draft("Moderação", null, Permission.MANAGE_MESSAGES), actorId);

        verify(realtimeEventPublisher).broadcast(eq(Set.of(targetId)), any(WsEvent.class));
    }

    @Test
    void creatingARoleNotifiesNobodyBecauseNobodyHoldsItYet() {
        roleService.createRole(serverId, draft("Dev", 1), actorId);

        verify(realtimeEventPublisher, never()).broadcast(any(), any(WsEvent.class));
    }

    @Test
    void deletingARoleNotifiesTheMembersWhoHeldIt() {
        when(memberRoleRepository.findUserIdsByRoleId(moderator.getId())).thenReturn(List.of(targetId));

        roleService.deleteRole(moderator.getId(), actorId);

        verify(realtimeEventPublisher).broadcast(eq(Set.of(targetId)), any(WsEvent.class));
    }

    @Test
    void assigningARoleNotifiesOnlyThatMember() {
        roleService.assignRole(serverId, targetId, moderator.getId(), actorId);

        verify(realtimeEventPublisher).broadcast(eq(Set.of(targetId)), any(WsEvent.class));
    }

    @Test
    void reorderingNotifiesTheWholeServerBecauseTheHierarchyChangedForEverybody() {
        roleService.updatePositions(serverId, List.of(new RolePosition(moderator.getId(), 2)), actorId);

        verify(realtimeEventPublisher).broadcast(eq(Set.of(targetId)), any(WsEvent.class));
    }

    // ---------- reads ----------

    @Test
    void listingRolesRequiresMembership() {
        UUID outsider = UUID.randomUUID();
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, outsider)).thenReturn(false);

        assertThatThrownBy(() -> roleService.listRoles(serverId, outsider))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void anyMemberCanSeeTheRoleList() {
        when(serverMemberRepository.existsByServerIdAndUserId(serverId, targetId)).thenReturn(true);
        when(roleRepository.findByServerIdOrderByPositionDescNameAsc(serverId))
                .thenReturn(List.of(moderator, everyone));

        assertThat(roleService.listRoles(serverId, targetId)).containsExactly(moderator, everyone);
    }
}
