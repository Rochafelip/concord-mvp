package com.concordmvp.permissions;

import com.concordmvp.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PermissionTest {

    @Test
    void everyPermissionHasADistinctSingleBit() {
        long seen = 0;
        for (Permission permission : Permission.values()) {
            assertThat(Long.bitCount(permission.bit()))
                    .as("%s must occupy exactly one bit", permission)
                    .isEqualTo(1);
            assertThat(seen & permission.bit())
                    .as("%s reuses a bit already taken by another permission", permission)
                    .isZero();
            seen |= permission.bit();
        }
    }

    @Test
    void bitIndexesAreFrozenBecauseTheyArePersisted() {
        // These indexes are written into roles.permissions / overrides.allow / overrides.deny as a
        // BIGINT. Renumbering any of them silently reinterprets every row already in the database.
        assertThat(Permission.ADMINISTRATOR.bit()).isEqualTo(1L);
        assertThat(Permission.MANAGE_SERVER.bit()).isEqualTo(1L << 1);
        assertThat(Permission.MANAGE_ROLES.bit()).isEqualTo(1L << 2);
        assertThat(Permission.MANAGE_CHANNELS.bit()).isEqualTo(1L << 3);
        assertThat(Permission.MANAGE_INVITES.bit()).isEqualTo(1L << 4);
        assertThat(Permission.VIEW_AUDIT_LOG.bit()).isEqualTo(1L << 5);
        assertThat(Permission.VIEW_MEMBER_LIST.bit()).isEqualTo(1L << 6);
        assertThat(Permission.KICK_MEMBERS.bit()).isEqualTo(1L << 7);
        assertThat(Permission.BAN_MEMBERS.bit()).isEqualTo(1L << 8);
        assertThat(Permission.TIMEOUT_MEMBERS.bit()).isEqualTo(1L << 9);
        assertThat(Permission.VIEW_CHANNEL.bit()).isEqualTo(1L << 10);
        assertThat(Permission.SEND_MESSAGES.bit()).isEqualTo(1L << 11);
        assertThat(Permission.READ_MESSAGE_HISTORY.bit()).isEqualTo(1L << 12);
        assertThat(Permission.ATTACH_FILES.bit()).isEqualTo(1L << 13);
        assertThat(Permission.MANAGE_MESSAGES.bit()).isEqualTo(1L << 14);
        assertThat(Permission.CONNECT.bit()).isEqualTo(1L << 15);
        assertThat(Permission.SPEAK.bit()).isEqualTo(1L << 16);
        assertThat(Permission.USE_VIDEO.bit()).isEqualTo(1L << 17);
        assertThat(Permission.SHARE_SCREEN.bit()).isEqualTo(1L << 18);
        assertThat(Permission.MUTE_MEMBERS.bit()).isEqualTo(1L << 19);
        assertThat(Permission.DEAFEN_MEMBERS.bit()).isEqualTo(1L << 20);
        assertThat(Permission.MOVE_MEMBERS.bit()).isEqualTo(1L << 21);
        assertThat(Permission.DISCONNECT_MEMBERS.bit()).isEqualTo(1L << 22);
        assertThat(Permission.values()).hasSize(23);
    }

    @Test
    void everyoneDefaultMatchesTheLiteralHardcodedInMigrationV18() {
        // V18__create_roles_and_permissions.sql backfills every pre-existing server's @everyone
        // role with the literal 506944. If this constant ever drifts from that literal, servers
        // created before the migration and servers created after it get different defaults.
        assertThat(Permission.EVERYONE_DEFAULT).isEqualTo(506944L);
    }

    @Test
    void everyoneDefaultPreservesExactlyWhatAnyMemberCouldAlreadyDo() {
        assertThat(PermissionSet.toSet(Permission.EVERYONE_DEFAULT)).containsExactlyInAnyOrder(
                Permission.VIEW_MEMBER_LIST,
                Permission.VIEW_CHANNEL,
                Permission.SEND_MESSAGES,
                Permission.READ_MESSAGE_HISTORY,
                Permission.ATTACH_FILES,
                Permission.CONNECT,
                Permission.SPEAK,
                Permission.USE_VIDEO,
                Permission.SHARE_SCREEN);
    }

    @Test
    void allContainsEveryDeclaredPermissionAndNothingElse() {
        long expected = Arrays.stream(Permission.values()).mapToLong(Permission::bit).reduce(0L, (a, b) -> a | b);
        assertThat(Permission.ALL).isEqualTo(expected);
        assertThat(PermissionSet.toSet(Permission.ALL)).containsExactlyInAnyOrder(Permission.values());
    }

    @Test
    void channelScopedContainsOnlyThePermissionsThatMeanSomethingInsideAChannel() {
        assertThat(PermissionSet.toSet(Permission.CHANNEL_SCOPED)).containsExactlyInAnyOrder(
                Permission.VIEW_CHANNEL,
                Permission.SEND_MESSAGES,
                Permission.READ_MESSAGE_HISTORY,
                Permission.ATTACH_FILES,
                Permission.MANAGE_MESSAGES,
                Permission.CONNECT,
                Permission.SPEAK,
                Permission.USE_VIDEO,
                Permission.SHARE_SCREEN,
                Permission.MUTE_MEMBERS,
                Permission.DEAFEN_MEMBERS,
                Permission.MOVE_MEMBERS,
                Permission.DISCONNECT_MEMBERS);
    }

    @Test
    void administratorIsNotChannelScopedSoItCannotBeGrantedByAnOverride() {
        assertThat(Permission.CHANNEL_SCOPED & Permission.ADMINISTRATOR.bit()).isZero();
        assertThat(Permission.CHANNEL_SCOPED & Permission.MANAGE_ROLES.bit()).isZero();
    }

    @Test
    void toSetOfZeroIsEmpty() {
        assertThat(PermissionSet.toSet(0L)).isEmpty();
    }

    @Test
    void toBitmaskAndToSetRoundTrip() {
        Set<Permission> original = EnumSet.of(Permission.VIEW_CHANNEL, Permission.MANAGE_MESSAGES, Permission.SPEAK);
        assertThat(PermissionSet.toSet(PermissionSet.toBitmask(original))).isEqualTo(original);
    }

    @Test
    void toBitmaskOfNullIsZero() {
        assertThat(PermissionSet.toBitmask((Set<Permission>) null)).isZero();
    }

    @Test
    void fromNamesParsesTheApiWireFormat() {
        assertThat(PermissionSet.fromNames(List.of("VIEW_CHANNEL", "SEND_MESSAGES")))
                .isEqualTo(Permission.VIEW_CHANNEL.bit() | Permission.SEND_MESSAGES.bit());
    }

    @Test
    void fromNamesOfNullIsZeroSoAnOmittedFieldMeansNoPermissions() {
        assertThat(PermissionSet.fromNames(null)).isZero();
    }

    @Test
    void fromNamesRejectsAnUnknownNameInsteadOfSilentlyDroppingIt() {
        assertThatThrownBy(() -> PermissionSet.fromNames(List.of("VIEW_CHANNEL", "BECOME_ROOT")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("BECOME_ROOT");
    }

    @Test
    void toNamesIsStableSoApiResponsesDoNotReorderBetweenCalls() {
        List<String> names = PermissionSet.toNames(
                Permission.SPEAK.bit() | Permission.VIEW_CHANNEL.bit() | Permission.ADMINISTRATOR.bit());
        assertThat(names).containsExactly("ADMINISTRATOR", "VIEW_CHANNEL", "SPEAK");
    }

    @Test
    void toSetIgnoresBitsThatDoNotMapToAnyPermission() {
        // Reserved bits 23..62 may show up in a row written by a future version. They must not
        // blow up an older instance reading that row.
        long withReservedBit = Permission.VIEW_CHANNEL.bit() | (1L << 40);
        assertThat(PermissionSet.toSet(withReservedBit)).containsExactly(Permission.VIEW_CHANNEL);
    }
}
