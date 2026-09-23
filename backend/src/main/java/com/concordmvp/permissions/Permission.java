package com.concordmvp.permissions;

/**
 * Every action a role can grant inside a server, as a single bit in a 63-bit field.
 *
 * <p><b>The bit indexes below are a persistence contract.</b> They are stored as a {@code BIGINT}
 * in {@code roles.permissions} and in {@code channel_permission_overrides.allow}/{@code deny}.
 * Renumbering, reordering or reusing an index silently reinterprets every row already in the
 * database. A permission that stops existing has its bit retired, never recycled — see
 * docs/DECISIONS.md D20.
 *
 * <p>Bits 23..62 are unused and reserved. {@link PermissionSet#toSet(long)} ignores them, so an
 * instance running an older build can read a row written by a newer one without blowing up.
 */
public enum Permission {

    // --- Server administration ---
    ADMINISTRATOR(0),
    /** Gates the server icon upload/removal — the only editable server field so far. */
    MANAGE_SERVER(1),
    MANAGE_ROLES(2),
    MANAGE_CHANNELS(3),
    MANAGE_INVITES(4),
    /** Reserved for the audit log (Spec B). */
    VIEW_AUDIT_LOG(5),

    // --- Members ---
    VIEW_MEMBER_LIST(6),
    /** Reserved for moderation (Spec B). */
    KICK_MEMBERS(7),
    /** Reserved for moderation (Spec B). */
    BAN_MEMBERS(8),
    /** Reserved for moderation (Spec B). */
    TIMEOUT_MEMBERS(9),

    // --- Text, evaluated per channel ---
    VIEW_CHANNEL(10),
    SEND_MESSAGES(11),
    READ_MESSAGE_HISTORY(12),
    ATTACH_FILES(13),
    MANAGE_MESSAGES(14),

    // --- Voice, evaluated per channel ---
    CONNECT(15),
    SPEAK(16),
    USE_VIDEO(17),
    SHARE_SCREEN(18),
    /** Reserved for moderation (Spec B). */
    MUTE_MEMBERS(19),
    /** Reserved for moderation (Spec B). */
    DEAFEN_MEMBERS(20),
    /** Reserved for moderation (Spec B). */
    MOVE_MEMBERS(21),
    DISCONNECT_MEMBERS(22);

    private final long bit;

    Permission(int index) {
        this.bit = 1L << index;
    }

    public long bit() {
        return bit;
    }

    /** Every declared permission. What the server owner and an {@link #ADMINISTRATOR} resolve to. */
    public static final long ALL = allBits();

    /**
     * The permissions that mean something inside a single channel, and therefore the only ones a
     * channel override may allow or deny. Granting {@code ADMINISTRATOR} or {@code MANAGE_ROLES}
     * through a per-channel override would be a privilege-escalation path, so they are excluded.
     */
    public static final long CHANNEL_SCOPED =
            VIEW_CHANNEL.bit | SEND_MESSAGES.bit | READ_MESSAGE_HISTORY.bit | ATTACH_FILES.bit
                    | MANAGE_MESSAGES.bit | CONNECT.bit | SPEAK.bit | USE_VIDEO.bit | SHARE_SCREEN.bit
                    | MUTE_MEMBERS.bit | DEAFEN_MEMBERS.bit | MOVE_MEMBERS.bit | DISCONNECT_MEMBERS.bit;

    /**
     * What {@code @everyone} starts with: exactly what every member could already do before roles
     * existed, so the V18 migration changes nobody's access. Duplicated as the literal 506944 in
     * {@code V18__create_roles_and_permissions.sql}; {@code PermissionTest} pins the two together.
     */
    public static final long EVERYONE_DEFAULT =
            VIEW_MEMBER_LIST.bit | VIEW_CHANNEL.bit | SEND_MESSAGES.bit | READ_MESSAGE_HISTORY.bit
                    | ATTACH_FILES.bit | CONNECT.bit | SPEAK.bit | USE_VIDEO.bit | SHARE_SCREEN.bit;

    private static long allBits() {
        long all = 0L;
        for (Permission permission : values()) {
            all |= permission.bit;
        }
        return all;
    }
}
