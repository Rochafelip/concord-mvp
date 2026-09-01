package com.concordmvp.messages;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /** First page (most recent messages), newest-first. */
    List<Message> findByChannelIdOrderByCreatedAtDescIdDesc(UUID channelId, Pageable pageable);

    /**
     * Older pages, newest-first, using a compound {@code (createdAt, id)} cursor.
     *
     * <p>A plain {@code createdAt < :before} filter is NOT sufficient here: two messages can
     * share the exact same {@code created_at} (timestamp resolution collision), and filtering on
     * {@code createdAt} alone silently and permanently drops whichever of them lands on the wrong
     * side of a page boundary. The {@code id} tiebreak in the WHERE clause (matching the
     * {@code id DESC} tiebreak already in the ORDER BY) closes that gap — verified against a real
     * Postgres instance during code review.
     */
    @Query("SELECT m FROM Message m WHERE m.channelId = :channelId "
            + "AND (m.createdAt < :before OR (m.createdAt = :before AND m.id < :beforeId)) "
            + "ORDER BY m.createdAt DESC, m.id DESC")
    List<Message> findPageBefore(@Param("channelId") UUID channelId,
                                  @Param("before") Instant before,
                                  @Param("beforeId") UUID beforeId,
                                  Pageable pageable);

    long deleteByChannelIdIn(Collection<UUID> channelIds);
}
