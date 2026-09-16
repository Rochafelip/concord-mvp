package com.concordmvp.permissions.dto;

import com.concordmvp.permissions.PermissionSet;
import com.concordmvp.permissions.Role;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Permissions travel as names, never as the stored bitmask: names survive a renumbering, are
 * readable in the browser's dev tools, and spare the frontend any bit arithmetic (D20).
 */
public record RoleResponse(UUID id,
                            UUID serverId,
                            String name,
                            String description,
                            String color,
                            int position,
                            boolean isEveryone,
                            List<String> permissions,
                            Instant createdAt,
                            Instant updatedAt) {

    public static RoleResponse from(Role role) {
        return new RoleResponse(role.getId(), role.getServerId(), role.getName(), role.getDescription(),
                role.getColor(), role.getPosition(), role.isEveryone(),
                PermissionSet.toNames(role.getPermissions()), role.getCreatedAt(), role.getUpdatedAt());
    }
}
