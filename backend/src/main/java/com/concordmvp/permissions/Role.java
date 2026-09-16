package com.concordmvp.permissions;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A named bundle of permissions inside one server.
 *
 * <p>Every server has exactly one role with {@code isEveryone == true}, at {@link #position} 0,
 * which applies to all members and cannot be deleted or repositioned. Higher {@code position}
 * means more authority (see {@link PermissionService#highestPosition}).
 */
@Entity
@Table(name = "roles")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "server_id", nullable = false)
    private UUID serverId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 200)
    private String description;

    /** {@code #RRGGBB}, or null for "use the theme's default role color". */
    @Column(length = 7)
    private String color;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private long permissions;

    @Column(name = "is_everyone", nullable = false)
    private boolean everyone;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Role() {
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getServerId() {
        return serverId;
    }

    public void setServerId(UUID serverId) {
        this.serverId = serverId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public long getPermissions() {
        return permissions;
    }

    public void setPermissions(long permissions) {
        this.permissions = permissions;
    }

    public boolean isEveryone() {
        return everyone;
    }

    public void setEveryone(boolean everyone) {
        this.everyone = everyone;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
