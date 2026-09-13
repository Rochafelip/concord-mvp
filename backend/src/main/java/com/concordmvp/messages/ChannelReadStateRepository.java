package com.concordmvp.messages;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannelReadStateRepository extends JpaRepository<ChannelReadState, UUID> {

    Optional<ChannelReadState> findByUserIdAndChannelId(UUID userId, UUID channelId);

    List<ChannelReadState> findByUserId(UUID userId);

    List<ChannelReadState> findByChannelId(UUID channelId);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.unreadCount = s.unreadCount + 1 WHERE s.userId = :userId AND s.channelId = :channelId")
    int incrementUnreadCount(@Param("userId") UUID userId, @Param("channelId") UUID channelId);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.unreadCount = 0, s.lastReadMessageId = :messageId, s.lastReadAt = :timestamp WHERE s.userId = :userId AND s.channelId = :channelId")
    int markAsRead(@Param("userId") UUID userId, @Param("channelId") UUID channelId, @Param("messageId") UUID messageId, @Param("timestamp") java.time.Instant timestamp);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.unreadCount = 0, s.lastReadAt = :timestamp WHERE s.userId = :userId AND s.channelId = :channelId")
    int markAsReadWithoutMessage(@Param("userId") UUID userId, @Param("channelId") UUID channelId, @Param("timestamp") java.time.Instant timestamp);
}
