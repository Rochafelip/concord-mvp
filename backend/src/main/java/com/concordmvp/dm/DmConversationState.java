package com.concordmvp.dm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One row means "userId can see a DM conversation with otherUserId in their conversation
 * list." Directional, unlike {@link DmMessage}'s normalized (low, high) pair — the same
 * conversation can be visible to one side and not the other (e.g. after a message you sent
 * but before the recipient has read it) — see
 * docs/superpowers/specs/2026-09-23-dm-conversation-visibility-design.md.
 */
@Entity
@Table(name = "dm_conversation_states")
public class DmConversationState {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "other_user_id", nullable = false)
    private UUID otherUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public DmConversationState() {
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getOtherUserId() {
        return otherUserId;
    }

    public void setOtherUserId(UUID otherUserId) {
        this.otherUserId = otherUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
