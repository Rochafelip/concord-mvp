package com.concordmvp.messages;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChannelReadStateRepository extends JpaRepository<ChannelReadState, UUID> {

    Optional<ChannelReadState> findByUserIdAndChannelId(UUID userId, UUID channelId);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.unreadCount = s.unreadCount + 1, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.channelId = :channelId AND s.userId IN :userIds")
    void incrementUnreadCount(@Param("channelId") UUID channelId, @Param("userIds") List<UUID> userIds);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.lastReadMessageId = :messageId, s.lastReadAt = CURRENT_TIMESTAMP, " +
           "s.unreadCount = 0, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.userId = :userId AND s.channelId = :channelId")
    void markAsRead(@Param("userId") UUID userId, @Param("channelId") UUID channelId, @Param("messageId") UUID messageId);

    @Modifying
    @Query("UPDATE ChannelReadState s SET s.lastReadAt = CURRENT_TIMESTAMP, s.unreadCount = 0, s.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE s.userId = :userId AND s.channelId = :channelId")
    void markAsReadWithoutMessage(@Param("userId") UUID userId, @Param("channelId") UUID channelId);

    List<ChannelReadState> findByUserId(UUID userId);

    List<ChannelReadState> findByChannelId(UUID channelId);
}
