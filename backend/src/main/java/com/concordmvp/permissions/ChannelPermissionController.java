package com.concordmvp.permissions;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.permissions.dto.ChannelOverrideResponse;
import com.concordmvp.permissions.dto.UpdateChannelOverrideRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
public class ChannelPermissionController {

    private final ChannelPermissionService channelPermissionService;

    public ChannelPermissionController(ChannelPermissionService channelPermissionService) {
        this.channelPermissionService = channelPermissionService;
    }

    @GetMapping("/api/v1/channels/{channelId}/permissions")
    public List<ChannelOverrideResponse> listOverrides(@PathVariable UUID channelId) {
        return channelPermissionService.listOverrides(channelId, CurrentUser.id()).stream()
                .map(ChannelOverrideResponse::from)
                .toList();
    }

    /**
     * Upsert. An override that neither allows nor denies anything is removed instead of stored,
     * which is why the response can be 204 rather than the override itself.
     */
    @PutMapping("/api/v1/channels/{channelId}/permissions/roles/{roleId}")
    public ResponseEntity<ChannelOverrideResponse> upsertRoleOverride(
            @PathVariable UUID channelId, @PathVariable UUID roleId,
            @Valid @RequestBody UpdateChannelOverrideRequest request) {
        ChannelPermissionOverride override = channelPermissionService.upsertRoleOverride(channelId, roleId,
                permissionsOf(request.allow()), permissionsOf(request.deny()), CurrentUser.id());
        return toResponse(override);
    }

    @PutMapping("/api/v1/channels/{channelId}/permissions/users/{userId}")
    public ResponseEntity<ChannelOverrideResponse> upsertUserOverride(
            @PathVariable UUID channelId, @PathVariable UUID userId,
            @Valid @RequestBody UpdateChannelOverrideRequest request) {
        ChannelPermissionOverride override = channelPermissionService.upsertUserOverride(channelId, userId,
                permissionsOf(request.allow()), permissionsOf(request.deny()), CurrentUser.id());
        return toResponse(override);
    }

    @DeleteMapping("/api/v1/channels/{channelId}/permissions/{overrideId}")
    public ResponseEntity<Void> deleteOverride(@PathVariable UUID channelId, @PathVariable UUID overrideId) {
        channelPermissionService.deleteOverride(channelId, overrideId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    private static ResponseEntity<ChannelOverrideResponse> toResponse(ChannelPermissionOverride override) {
        return override == null
                ? ResponseEntity.noContent().build()
                : ResponseEntity.ok(ChannelOverrideResponse.from(override));
    }

    private static Set<Permission> permissionsOf(List<String> names) {
        return PermissionSet.toSet(PermissionSet.fromNames(names));
    }
}
