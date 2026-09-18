package com.concordmvp.dm;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface DmMessageRepository extends JpaRepository<DmMessage, UUID> {

    /** First page (most recent messages), newest-first. */
    List<DmMessage> findByUserLowIdAndUserHighIdOrderByCreatedAtDescIdDesc(
            UUID userLowId, UUID userHighId, Pageable pageable);

    /**
     * Older pages, newest-first, using a compound {@code (createdAt, id)} cursor — same
     * reasoning as {@code MessageRepository#findPageBefore}: a plain {@code createdAt < :before}
     * filter alone can silently skip messages sharing the cursor's exact timestamp.
     */
    @Query("SELECT m FROM DmMessage m WHERE m.userLowId = :userLowId AND m.userHighId = :userHighId "
            + "AND (m.createdAt < :before OR (m.createdAt = :before AND m.id < :beforeId)) "
            + "ORDER BY m.createdAt DESC, m.id DESC")
    List<DmMessage> findPageBefore(@Param("userLowId") UUID userLowId,
                                    @Param("userHighId") UUID userHighId,
                                    @Param("before") Instant before,
                                    @Param("beforeId") UUID beforeId,
                                    Pageable pageable);
}
