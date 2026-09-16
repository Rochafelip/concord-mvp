package com.concordmvp.permissions;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.servers.Server;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.servers.ServerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PermissionServiceTest {

    @Mock private ServerRepository serverRepository;
    @Mock private ServerMemberRepository serverMemberRepository;
    @Mock private ChannelRepository channelRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private ChannelPermissionOverrideRepository overrideRepository;

    private PermissionService permissionService;

    private final UUID serverId = UUID.randomUUID();
    private final UUID ownerId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();
    private final UUID strangerId = UUID.randomUUID();
    private final UUID channelId = UUID.randomUUID();
    private final UUID membershipId = UUID.randomUUID();

    private Role everyone;

    @BeforeEach
    void setUp() {
        permissionService = new PermissionService(serverRepository, serverMemberRepository,
                channelRepository, roleRepository, overrideRepository);

        Server server = new Server();
        server.setId(serverId);
        server.setOwnerId(ownerId);
        when(serverRepository.findById(serverId)).thenReturn(Optional.of(server));

        ServerMember membership = new ServerMember();
        membership.setId(membershipId);
        membership.setServerId(serverId);
        membership.setUserId(memberId);
        when(serverMemberRepository.findByServerIdAndUserId(serverId, memberId)).thenReturn(Optional.of(membership));
        when(serverMemberRepository.findByServerIdAndUserId(serverId, strangerId)).thenReturn(Optional.empty());

        ServerMember ownerMembership = new ServerMember();
        ownerMembership.setId(UUID.randomUUID());
        ownerMembership.setServerId(serverId);
        ownerMembership.setUserId(ownerId);
        when(serverMemberRepository.findByServerIdAndUserId(serverId, ownerId)).thenReturn(Optional.of(ownerMembership));

        when(channelRepository.findById(channelId)).thenReturn(Optional.of(channel(channelId)));

        everyone = role("@everyone", 0, Permission.EVERYONE_DEFAULT);
        everyone.setEveryone(true);
        rolesOf(memberId, everyone);
        overridesOn(channelId);
    }

    // ---------- helpers ----------

    private Channel channel(UUID id) {
        Channel c = new Channel();
        c.setId(id);
        c.setServerId(serverId);
        return c;
    }

    private Role role(String name, int position, long permissions) {
        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setServerId(serverId);
        role.setName(name);
        role.setPosition(position);
        role.setPermissions(permissions);
        return role;
    }

    /** Roles are returned position-DESC, as findEffectiveRoles' ORDER BY guarantees. */
    private void rolesOf(UUID userId, Role... roles) {
        UUID membership = userId.equals(memberId) ? membershipId : UUID.randomUUID();
        when(roleRepository.findEffectiveRoles(serverId, membership))
                .thenReturn(List.of(roles).stream()
                        .sorted((a, b) -> Integer.compare(b.getPosition(), a.getPosition()))
                        .toList());
    }

    private void overridesOn(UUID id, ChannelPermissionOverride... overrides) {
        when(overrideRepository.findByChannelId(id)).thenReturn(List.of(overrides));
        when(overrideRepository.findByChannelIdIn(anyCollection())).thenReturn(List.of(overrides));
    }

    private static long bits(Permission... permissions) {
        return PermissionSet.toBitmask(Set.of(permissions));
    }

    // ---------- owner and membership ----------

    @Test
    void ownerGetsEverythingEvenWhenTheChannelDeniesEverything() {
        overridesOn(channelId, ChannelPermissionOverride.forRole(channelId, everyone.getId(), 0L, Permission.ALL));

        assertThat(permissionService.serverPermissions(serverId, ownerId)).isEqualTo(Permission.ALL);
        assertThat(permissionService.channelPermissions(channelId, ownerId)).isEqualTo(Permission.ALL);
    }

    @Test
    void ownerIsResolvedWithoutEvenLookingAtRoles() {
        permissionService.serverPermissions(serverId, ownerId);

        verify(roleRepository, never()).findEffectiveRoles(any(), any());
    }

    @Test
    void aUserWhoIsNotAMemberGetsNothingEvenThoughEveryoneAppliesToAllMembers() {
        assertThat(permissionService.serverPermissions(serverId, strangerId)).isZero();
        assertThat(permissionService.channelPermissions(channelId, strangerId)).isZero();
    }

    @Test
    void unknownServerIsNotFound() {
        UUID missing = UUID.randomUUID();
        when(serverRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> permissionService.serverPermissions(missing, memberId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void unknownChannelIsNotFound() {
        UUID missing = UUID.randomUUID();
        when(channelRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> permissionService.channelPermissions(missing, memberId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------- role aggregation ----------

    @Test
    void aPlainMemberGetsExactlyWhatEveryoneGrants() {
        assertThat(permissionService.serverPermissions(serverId, memberId)).isEqualTo(Permission.EVERYONE_DEFAULT);
    }

    @Test
    void multipleRolesAreUnioned() {
        rolesOf(memberId, everyone,
                role("Moderador", 2, bits(Permission.MANAGE_MESSAGES)),
                role("Dev", 1, bits(Permission.MANAGE_CHANNELS)));

        assertThat(permissionService.serverPermissions(serverId, memberId)).isEqualTo(
                Permission.EVERYONE_DEFAULT | bits(Permission.MANAGE_MESSAGES, Permission.MANAGE_CHANNELS));
    }

    @Test
    void administratorResolvesToEverythingAndIgnoresChannelOverrides() {
        rolesOf(memberId, everyone, role("Admin", 5, bits(Permission.ADMINISTRATOR)));
        overridesOn(channelId, ChannelPermissionOverride.forRole(channelId, everyone.getId(), 0L, Permission.ALL));

        assertThat(permissionService.channelPermissions(channelId, memberId)).isEqualTo(Permission.ALL);
    }

    // ---------- channel overrides ----------

    @Test
    void everyoneOverrideCanTakeAChannelAwayFromPlainMembers() {
        overridesOn(channelId,
                ChannelPermissionOverride.forRole(channelId, everyone.getId(), 0L, bits(Permission.VIEW_CHANNEL)));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.VIEW_CHANNEL)).isFalse();
    }

    @Test
    void aRoleOverrideGrantsBackWhatTheEveryoneOverrideDenied() {
        Role moderator = role("Moderador", 2, 0L);
        rolesOf(memberId, everyone, moderator);
        overridesOn(channelId,
                ChannelPermissionOverride.forRole(channelId, everyone.getId(), 0L, bits(Permission.VIEW_CHANNEL)),
                ChannelPermissionOverride.forRole(channelId, moderator.getId(), bits(Permission.VIEW_CHANNEL), 0L));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.VIEW_CHANNEL)).isTrue();
    }

    @Test
    void withoutTheRoleTheSameChannelStaysHidden() {
        Role moderator = role("Moderador", 2, 0L);
        // memberId does NOT have the moderator role.
        overridesOn(channelId,
                ChannelPermissionOverride.forRole(channelId, everyone.getId(), 0L, bits(Permission.VIEW_CHANNEL)),
                ChannelPermissionOverride.forRole(channelId, moderator.getId(), bits(Permission.VIEW_CHANNEL), 0L));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.VIEW_CHANNEL)).isFalse();
    }

    @Test
    void allowFromOneRoleBeatsDenyFromAnotherRoleBecauseRolesAreAggregatedBeforeBeingApplied() {
        Role denier = role("Silenciado", 1, 0L);
        Role allower = role("VIP", 2, 0L);
        rolesOf(memberId, everyone, denier, allower);
        overridesOn(channelId,
                ChannelPermissionOverride.forRole(channelId, denier.getId(), 0L, bits(Permission.SEND_MESSAGES)),
                ChannelPermissionOverride.forRole(channelId, allower.getId(), bits(Permission.SEND_MESSAGES), 0L));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.SEND_MESSAGES)).isTrue();
    }

    @Test
    void aUserOverrideDenyBeatsAnyRoleAllow() {
        Role allower = role("VIP", 9, 0L);
        rolesOf(memberId, everyone, allower);
        overridesOn(channelId,
                ChannelPermissionOverride.forRole(channelId, allower.getId(), bits(Permission.SEND_MESSAGES), 0L),
                ChannelPermissionOverride.forUser(channelId, memberId, 0L, bits(Permission.SEND_MESSAGES)));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.SEND_MESSAGES)).isFalse();
    }

    @Test
    void aUserOverrideAllowBeatsTheEveryoneDeny() {
        overridesOn(channelId,
                ChannelPermissionOverride.forRole(channelId, everyone.getId(), 0L, bits(Permission.VIEW_CHANNEL)),
                ChannelPermissionOverride.forUser(channelId, memberId, bits(Permission.VIEW_CHANNEL), 0L));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.VIEW_CHANNEL)).isTrue();
    }

    @Test
    void anotherUsersOverrideIsIgnored() {
        overridesOn(channelId,
                ChannelPermissionOverride.forUser(channelId, strangerId, 0L, bits(Permission.VIEW_CHANNEL)));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.VIEW_CHANNEL)).isTrue();
    }

    @Test
    void precedenceIsEveryoneThenRolesThenUser() {
        // @everyone allows, the role denies, the user allows again: the last word is the user's.
        Role moderator = role("Moderador", 3, 0L);
        rolesOf(memberId, everyone, moderator);
        overridesOn(channelId,
                ChannelPermissionOverride.forRole(channelId, everyone.getId(), bits(Permission.ATTACH_FILES), 0L),
                ChannelPermissionOverride.forRole(channelId, moderator.getId(), 0L, bits(Permission.ATTACH_FILES)),
                ChannelPermissionOverride.forUser(channelId, memberId, bits(Permission.ATTACH_FILES), 0L));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.ATTACH_FILES)).isTrue();
    }

    @Test
    void anOverrideCannotGrantAServerScopedPermissionEvenIfTheRowSaysSo() {
        // A row written by hand (or by a future bug) must not turn into ADMINISTRATOR.
        overridesOn(channelId,
                ChannelPermissionOverride.forUser(channelId, memberId, Permission.ADMINISTRATOR.bit(), 0L));

        assertThat(permissionService.hasChannel(channelId, memberId, Permission.ADMINISTRATOR)).isFalse();
    }

    // ---------- filterVisible ----------

    @Test
    void filterVisibleKeepsOnlyChannelsTheUserCanSee() {
        UUID hiddenId = UUID.randomUUID();
        Channel visible = channel(channelId);
        Channel hidden = channel(hiddenId);
        when(overrideRepository.findByChannelIdIn(anyCollection())).thenReturn(List.of(
                ChannelPermissionOverride.forRole(hiddenId, everyone.getId(), 0L, bits(Permission.VIEW_CHANNEL))));

        List<Channel> result = permissionService.filterVisible(List.of(visible, hidden), serverId, memberId);

        assertThat(result).extracting(Channel::getId).containsExactly(channelId);
    }

    @Test
    void filterVisibleStaysAtOneOverrideQueryRegardlessOfChannelCount() {
        List<Channel> channels = List.of(channel(UUID.randomUUID()), channel(UUID.randomUUID()),
                channel(UUID.randomUUID()), channel(UUID.randomUUID()));

        permissionService.filterVisible(channels, serverId, memberId);

        verify(overrideRepository, times(1)).findByChannelIdIn(anyCollection());
        verify(overrideRepository, never()).findByChannelId(any());
        verify(roleRepository, times(1)).findEffectiveRoles(any(), any());
    }

    @Test
    void filterVisibleShortCircuitsOnAnEmptyListWithoutQueryingAnything() {
        assertThat(permissionService.filterVisible(List.of(), serverId, memberId)).isEmpty();

        verify(overrideRepository, never()).findByChannelIdIn(anyCollection());
    }

    @Test
    void filterVisibleGivesTheOwnerEveryChannel() {
        UUID hiddenId = UUID.randomUUID();
        when(overrideRepository.findByChannelIdIn(anyCollection())).thenReturn(List.of(
                ChannelPermissionOverride.forRole(hiddenId, everyone.getId(), 0L, Permission.ALL)));

        List<Channel> result = permissionService.filterVisible(
                List.of(channel(channelId), channel(hiddenId)), serverId, ownerId);

        assertThat(result).hasSize(2);
    }

    // ---------- require* ----------

    @Test
    void requireChannelThrowsForbiddenWhenTheUserLacksThePermission() {
        assertThatThrownBy(() -> permissionService.requireChannel(channelId, memberId, Permission.MANAGE_MESSAGES))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void requireChannelIsSilentWhenTheUserHasThePermission() {
        permissionService.requireChannel(channelId, memberId, Permission.SEND_MESSAGES);
    }

    @Test
    void requireServerThrowsForbiddenWhenTheUserLacksThePermission() {
        assertThatThrownBy(() -> permissionService.requireServer(serverId, memberId, Permission.MANAGE_ROLES))
                .isInstanceOf(ForbiddenException.class);
    }

    // ---------- hierarchy ----------

    @Test
    void theOwnerOutranksEverybody() {
        assertThat(permissionService.highestPosition(serverId, ownerId)).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void aMembersRankIsTheHighestPositionAmongItsRoles() {
        rolesOf(memberId, everyone, role("Moderador", 3, 0L), role("Dev", 7, 0L));

        assertThat(permissionService.highestPosition(serverId, memberId)).isEqualTo(7);
    }

    @Test
    void aMemberWithOnlyEveryoneRanksZero() {
        assertThat(permissionService.highestPosition(serverId, memberId)).isZero();
    }

    @Test
    void outranksIsStrictSoEqualRanksCannotActOnEachOther() {
        rolesOf(memberId, everyone, role("Moderador", 3, 0L));

        assertThat(permissionService.outranks(serverId, ownerId, memberId)).isTrue();
        assertThat(permissionService.outranks(serverId, memberId, ownerId)).isFalse();
        assertThat(permissionService.outranks(serverId, memberId, memberId)).isFalse();
        assertThat(permissionService.outranks(serverId, memberId, strangerId)).isTrue();
    }

    @Test
    void aNonMemberRanksBelowEveryone() {
        assertThat(permissionService.highestPosition(serverId, strangerId)).isEqualTo(Integer.MIN_VALUE);
    }
}
