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
 * A direct message between exactly two users. There is no separate "conversation" entity — the
 * conversation IS the (userLowId, userHighId) pair, always stored with {@code userLowId <
 * userHighId} regardless of who sent the first message (see
 * V20__create_dm_messages.sql's {@code chk_dm_messages_ordered_pair}), so a lookup for a given
 * pair never has to try both orderings.
 */
@Entity
@Table(name = "dm_messages")
public class DmMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_low_id", nullable = false)
    private UUID userLowId;

    @Column(name = "user_high_id", nullable = false)
    private UUID userHighId;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(nullable = false, length = 4000)
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public DmMessage() {
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

    public UUID getUserLowId() {
        return userLowId;
    }

    public void setUserLowId(UUID userLowId) {
        this.userLowId = userLowId;
    }

    public UUID getUserHighId() {
        return userHighId;
    }

    public void setUserHighId(UUID userHighId) {
        this.userHighId = userHighId;
    }

    public UUID getAuthorId() {
        return authorId;
    }

    public void setAuthorId(UUID authorId) {
        this.authorId = authorId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    /** The non-author participant of this message. */
    public UUID recipientId() {
        return userLowId.equals(authorId) ? userHighId : userLowId;
    }
}
