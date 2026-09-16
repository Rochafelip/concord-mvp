package com.concordmvp.permissions;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Assignment of a {@link Role} to a membership.
 *
 * <p>Keyed on {@code server_members.id} rather than {@code (server_id, user_id)}: leaving a server
 * deletes the {@code server_members} row, and the FK cascade takes the assignments with it, so
 * {@code ServerService.leaveServer} needs no extra cleanup.
 */
@Entity
@Table(name = "member_roles")
@IdClass(MemberRole.Key.class)
public class MemberRole {

    @Id
    @Column(name = "server_member_id", nullable = false)
    private UUID serverMemberId;

    @Id
    @Column(name = "role_id", nullable = false)
    private UUID roleId;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    public MemberRole() {
    }

    public MemberRole(UUID serverMemberId, UUID roleId) {
        this.serverMemberId = serverMemberId;
        this.roleId = roleId;
    }

    @PrePersist
    protected void onCreate() {
        this.assignedAt = Instant.now();
    }

    public UUID getServerMemberId() {
        return serverMemberId;
    }

    public void setServerMemberId(UUID serverMemberId) {
        this.serverMemberId = serverMemberId;
    }

    public UUID getRoleId() {
        return roleId;
    }

    public void setRoleId(UUID roleId) {
        this.roleId = roleId;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public static class Key implements Serializable {
        private UUID serverMemberId;
        private UUID roleId;

        public Key() {
        }

        public Key(UUID serverMemberId, UUID roleId) {
            this.serverMemberId = serverMemberId;
            this.roleId = roleId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(serverMemberId, key.serverMemberId) && Objects.equals(roleId, key.roleId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(serverMemberId, roleId);
        }
    }
}
