package com.concordmvp.permissions;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.permissions.dto.CreateRoleRequest;
import com.concordmvp.permissions.dto.RolePositionsRequest;
import com.concordmvp.permissions.dto.RoleResponse;
import com.concordmvp.permissions.dto.UpdateRoleRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Thin by design: every authorization decision — MANAGE_ROLES, the hierarchy, the no-self-elevation
 * rule — lives in {@link RoleService}, which is what a direct API call hits too.
 */
@RestController
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping("/api/v1/servers/{serverId}/roles")
    public List<RoleResponse> listRoles(@PathVariable UUID serverId) {
        return roleService.listRoles(serverId, CurrentUser.id()).stream().map(RoleResponse::from).toList();
    }

    @PostMapping("/api/v1/servers/{serverId}/roles")
    public ResponseEntity<RoleResponse> createRole(@PathVariable UUID serverId,
                                                     @Valid @RequestBody CreateRoleRequest request) {
        RoleDraft draft = new RoleDraft(request.name(), request.description(), request.color(),
                request.position(), permissionsOf(request.permissions()));
        Role role = roleService.createRole(serverId, draft, CurrentUser.id());
        return ResponseEntity.status(HttpStatus.CREATED).body(RoleResponse.from(role));
    }

    @PatchMapping("/api/v1/roles/{roleId}")
    public RoleResponse updateRole(@PathVariable UUID roleId, @Valid @RequestBody UpdateRoleRequest request) {
        // permissions stays null when the field is absent, which RoleService reads as "unchanged".
        RoleDraft draft = new RoleDraft(request.name(), request.description(), request.color(),
                request.position(),
                request.permissions() == null ? null : permissionsOf(request.permissions()));
        return RoleResponse.from(roleService.updateRole(roleId, draft, CurrentUser.id()));
    }

    @DeleteMapping("/api/v1/roles/{roleId}")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID roleId) {
        roleService.deleteRole(roleId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/api/v1/servers/{serverId}/roles/positions")
    public List<RoleResponse> updatePositions(@PathVariable UUID serverId,
                                                @Valid @RequestBody RolePositionsRequest request) {
        List<RolePosition> positions = request.roles().stream()
                .map(entry -> new RolePosition(entry.roleId(), entry.position()))
                .toList();
        roleService.updatePositions(serverId, positions, CurrentUser.id());
        return roleService.listRoles(serverId, CurrentUser.id()).stream().map(RoleResponse::from).toList();
    }

    @GetMapping("/api/v1/servers/{serverId}/members/{userId}/roles")
    public List<RoleResponse> listMemberRoles(@PathVariable UUID serverId, @PathVariable UUID userId) {
        return roleService.listMemberRoles(serverId, userId, CurrentUser.id()).stream()
                .map(RoleResponse::from)
                .toList();
    }

    @PutMapping("/api/v1/servers/{serverId}/members/{userId}/roles/{roleId}")
    public ResponseEntity<Void> assignRole(@PathVariable UUID serverId, @PathVariable UUID userId,
                                             @PathVariable UUID roleId) {
        roleService.assignRole(serverId, userId, roleId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/v1/servers/{serverId}/members/{userId}/roles/{roleId}")
    public ResponseEntity<Void> unassignRole(@PathVariable UUID serverId, @PathVariable UUID userId,
                                               @PathVariable UUID roleId) {
        roleService.unassignRole(serverId, userId, roleId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    private static Set<Permission> permissionsOf(List<String> names) {
        return PermissionSet.toSet(PermissionSet.fromNames(names));
    }
}
