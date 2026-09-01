package com.concordmvp.messages;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /** First page (most recent messages), newest-first. */
    List<Message> findByChannelIdOrderByCreatedAtDescIdDesc(UUID channelId, Pageable pageable);

    /** Older pages (cursor-based via {@code before}), newest-first. */
    List<Message> findByChannelIdAndCreatedAtBeforeOrderByCreatedAtDescIdDesc(UUID channelId, Instant before, Pageable pageable);

    long deleteByChannelIdIn(Collection<UUID> channelIds);
}
