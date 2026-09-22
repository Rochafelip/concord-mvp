package com.concordmvp.permissions;

import com.concordmvp.common.exception.BadRequestException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Converts between the {@code long} bitmask used in the database and the permission-name arrays
 * used on the wire.
 *
 * <p>The API never exposes the raw number: names survive a renumbering, are readable in the
 * browser's dev tools, and spare the frontend any bit arithmetic (docs/DECISIONS.md D20).
 */
public final class PermissionSet {

    private PermissionSet() {
    }

    /** Bits that map to no declared permission are dropped rather than rejected — see {@link Permission}. */
    public static Set<Permission> toSet(long bitmask) {
        EnumSet<Permission> permissions = EnumSet.noneOf(Permission.class);
        for (Permission permission : Permission.values()) {
            if ((bitmask & permission.bit()) != 0) {
                permissions.add(permission);
            }
        }
        return permissions;
    }

    public static long toBitmask(Set<Permission> permissions) {
        if (permissions == null) {
            return 0L;
        }
        long bitmask = 0L;
        for (Permission permission : permissions) {
            bitmask |= permission.bit();
        }
        return bitmask;
    }

    /** Declaration order, so a response's permission array never reshuffles between calls. */
    public static List<String> toNames(long bitmask) {
        List<String> names = new ArrayList<>();
        for (Permission permission : Permission.values()) {
            if ((bitmask & permission.bit()) != 0) {
                names.add(permission.name());
            }
        }
        return names;
    }

    /**
     * A null or absent collection means "no permissions". An unknown name is a 400 rather than a
     * silent drop: a typo in a client must not quietly produce a role with fewer permissions than
     * whoever created it intended.
     */
    public static long fromNames(Collection<String> names) {
        if (names == null) {
            return 0L;
        }
        long bitmask = 0L;
        for (String name : names) {
            bitmask |= parse(name).bit();
        }
        return bitmask;
    }

    private static Permission parse(String name) {
        if (name == null) {
            throw new BadRequestException("Permission name must not be null");
        }
        try {
            return Permission.valueOf(name.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown permission: " + name);
        }
    }

    public static boolean has(long bitmask, Permission permission) {
        return (bitmask & permission.bit()) != 0;
    }
}
