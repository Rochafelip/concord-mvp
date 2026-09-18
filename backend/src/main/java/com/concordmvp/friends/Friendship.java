package com.concordmvp.friends;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A friend request or friendship between two users. {@code requesterId} is whoever sent the
 * request — kept even after acceptance so it stays clear who can cancel (the requester) versus
 * who can accept/decline (the addressee) while it is still {@link FriendshipStatus#PENDING}.
 */
@Entity
@Table(name = "friendships")
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "requester_id", nullable = false)
    private UUID requesterId;

    @Column(name = "addressee_id", nullable = false)
    private UUID addresseeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private FriendshipStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Friendship() {
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

    public UUID getRequesterId() {
        return requesterId;
    }

    public void setRequesterId(UUID requesterId) {
        this.requesterId = requesterId;
    }

    public UUID getAddresseeId() {
        return addresseeId;
    }

    public void setAddresseeId(UUID addresseeId) {
        this.addresseeId = addresseeId;
    }

    public FriendshipStatus getStatus() {
        return status;
    }

    public void setStatus(FriendshipStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    /** The other person in this friendship, relative to {@code userId}. */
    public UUID otherUserId(UUID userId) {
        return requesterId.equals(userId) ? addresseeId : requesterId;
    }

    public boolean involves(UUID userId) {
        return requesterId.equals(userId) || addresseeId.equals(userId);
    }
}
