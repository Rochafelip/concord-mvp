package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChannelReadStateService {

    private static final Logger log = LoggerFactory.getLogger(ChannelReadStateService.class);

    private final ChannelReadStateRepository channelReadStateRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;

    public ChannelReadStateService(
            ChannelReadStateRepository channelReadStateRepository,
            ServerMemberRepository serverMemberRepository,
            ChannelRepository channelRepository,
            MessageRepository messageRepository) {
        this.channelReadStateRepository = channelReadStateRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.channelRepository = channelRepository;
        this.messageRepository = messageRepository;
    }

    /**
     * Initialize read state for a user in a specific channel.
     * This is idempotent - if a read state already exists, it returns the existing one.
     */
    @Transactional
    public ChannelReadState initializeReadState(UUID userId, UUID channelId) {
        Optional<ChannelReadState> existing = channelReadStateRepository.findByUserIdAndChannelId(userId, channelId);
        if (existing.isPresent()) {
            return existing.get();
        }

        ChannelReadState state = new ChannelReadState();
        state.setUserId(userId);
        state.setChannelId(channelId);
        state.setLastReadAt(Instant.now());
        state.setUnreadCount(0);
        return channelReadStateRepository.save(state);
    }

    /**
     * Increment unread count for all members of a channel except the specified user.
     * Used when a new message is sent.
     */
    @Transactional
    public void incrementUnreadForChannelMembers(UUID channelId, UUID excludeUserId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel not found: " + channelId));

        List<ServerMember> members = serverMemberRepository.findByServerId(channel.getServerId());

        for (ServerMember member : members) {
            if (!member.getUserId().equals(excludeUserId)) {
                try {
                    // Ensure read state exists before incrementing
                    initializeReadState(member.getUserId(), channelId);
                    int updated = channelReadStateRepository.incrementUnreadCount(member.getUserId(), channelId);
                    if (updated == 0) {
                        log.warn("Failed to increment unread count for user {} in channel {}", member.getUserId(), channelId);
                    }
                } catch (Exception e) {
                    log.error("Error incrementing unread count for user {} in channel {}", member.getUserId(), channelId, e);
                }
            }
        }
    }

    /**
     * Mark a channel as read for a specific user.
     * Resets unread count to zero and updates the last read message ID.
     */
    @Transactional
    public ChannelReadState markChannelAsRead(UUID userId, UUID channelId, UUID lastReadMessageId) {
        if (lastReadMessageId == null) {
            return markChannelAsReadWithoutMessage(userId, channelId);
        }

        ChannelReadState state = channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElseGet(() -> initializeReadState(userId, channelId));

        int updated = channelReadStateRepository.markAsRead(userId, channelId, lastReadMessageId, Instant.now());
        if (updated == 0) {
            log.warn("Failed to mark channel as read for user {} in channel {}", userId, channelId);
        }

        // Refresh the state from database to get updated values
        state = channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Read state not found after update"));

        return state;
    }

    /**
     * Mark a channel as read without a specific message ID.
     * Used when user visits a channel but there are no messages.
     */
    @Transactional
    public ChannelReadState markChannelAsReadWithoutMessage(UUID userId, UUID channelId) {
        ChannelReadState state = channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElseGet(() -> initializeReadState(userId, channelId));

        int updated = channelReadStateRepository.markAsReadWithoutMessage(userId, channelId, Instant.now());
        if (updated == 0) {
            log.warn("Failed to mark channel as read (no message) for user {} in channel {}", userId, channelId);
        }

        // Refresh the state from database to get updated values
        state = channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Read state not found after update"));

        return state;
    }

    /**
     * Get read state for a specific user-channel pair.
     */
    public Optional<ChannelReadState> getReadState(UUID userId, UUID channelId) {
        return channelReadStateRepository.findByUserIdAndChannelId(userId, channelId);
    }

    /**
     * Get all read states for a specific user.
     */
    public List<ChannelReadState> getUserReadStates(UUID userId) {
        return channelReadStateRepository.findByUserId(userId);
    }

    /**
     * Get unread count for a specific user-channel pair.
     * Returns 0 if no read state exists.
     */
    public Integer getUnreadCount(UUID userId, UUID channelId) {
        return channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .map(ChannelReadState::getUnreadCount)
                .orElse(0);
    }

    /**
     * Recalculate unread count from scratch for a specific user-channel pair.
     * Used for data consistency when the cached count might be incorrect.
     */
    @Transactional
    public void recalculateUnreadCount(UUID userId, UUID channelId) {
        ChannelReadState state = channelReadStateRepository.findByUserIdAndChannelId(userId, channelId)
                .orElseGet(() -> initializeReadState(userId, channelId));

        // Count messages created after last_read_at
        // This is a simplified version - in production you might want to use last_read_message_id
        // for more accurate cursor-based tracking
        long actualUnread = countMessagesAfter(channelId, state.getLastReadAt());

        state.setUnreadCount((int) actualUnread);
        channelReadStateRepository.save(state);
    }

    /**
     * Initialize read states for all channels in a server for a specific user.
     * Used when a user joins a server.
     */
    @Transactional
    public void initializeReadStatesForServer(UUID userId, UUID serverId) {
        List<Channel> channels = channelRepository.findByServerId(serverId);

        for (Channel channel : channels) {
            try {
                initializeReadState(userId, channel.getId());
            } catch (Exception e) {
                log.error("Error initializing read state for user {} in channel {}", userId, channel.getId(), e);
            }
        }

        log.info("Initialized read states for user {} in server {} ({} channels)", userId, serverId, channels.size());
    }

    private long countMessagesAfter(UUID channelId, Instant timestamp) {
        return messageRepository.countByChannelIdAndCreatedAtAfter(channelId, timestamp);
    }
}
