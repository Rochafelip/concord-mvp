package com.concordmvp.permissions;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * A per-channel exception to the server-wide permissions, targeting either a role or a single
 * user — exactly one of {@link #roleId}/{@link #userId} is set, enforced by a CHECK constraint.
 *
 * <p>Both tables in one: a role override and a user override are the same shape and are always
 * read together, so splitting them would double the query count of {@link PermissionService} for
 * no gain.
 */
@Entity
@Table(name = "channel_permission_overrides")
public class ChannelPermissionOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "channel_id", nullable = false)
    private UUID channelId;

    @Column(name = "role_id")
    private UUID roleId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private long allow;

    @Column(nullable = false)
    private long deny;

    public ChannelPermissionOverride() {
    }

    public static ChannelPermissionOverride forRole(UUID channelId, UUID roleId, long allow, long deny) {
        ChannelPermissionOverride override = new ChannelPermissionOverride();
        override.channelId = channelId;
        override.roleId = roleId;
        override.allow = allow;
        override.deny = deny;
        return override;
    }

    public static ChannelPermissionOverride forUser(UUID channelId, UUID userId, long allow, long deny) {
        ChannelPermissionOverride override = new ChannelPermissionOverride();
        override.channelId = channelId;
        override.userId = userId;
        override.allow = allow;
        override.deny = deny;
        return override;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getChannelId() {
        return channelId;
    }

    public void setChannelId(UUID channelId) {
        this.channelId = channelId;
    }

    public UUID getRoleId() {
        return roleId;
    }

    public void setRoleId(UUID roleId) {
        this.roleId = roleId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public long getAllow() {
        return allow;
    }

    public void setAllow(long allow) {
        this.allow = allow;
    }

    public long getDeny() {
        return deny;
    }

    public void setDeny(long deny) {
        this.deny = deny;
    }
}
