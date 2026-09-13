package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.common.CurrentUser;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.dto.ChannelReadStateResponse;
import com.concordmvp.messages.dto.MarkChannelReadRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/channels")
public class ChannelReadStateController {

    private final ChannelReadStateService channelReadStateService;
    private final ChannelService channelService;

    public ChannelReadStateController(
            ChannelReadStateService channelReadStateService,
            ChannelService channelService) {
        this.channelReadStateService = channelReadStateService;
        this.channelService = channelService;
    }

    /**
     * Mark a channel as read for the current user.
     * Resets the unread count to zero and updates the last read message ID.
     */
    @PostMapping("/{channelId}/read")
    public ResponseEntity<Void> markChannelAsRead(
            @PathVariable UUID channelId,
            @Valid @RequestBody MarkChannelReadRequest request) {
        UUID userId = CurrentUser.id();

        // Verify the user has access to this channel
        Channel channel = channelService.getChannel(channelId, userId);

        // Mark the channel as read
        channelReadStateService.markChannelAsRead(userId, channelId, request.lastReadMessageId());

        return ResponseEntity.noContent().build();
    }

    /**
     * Get the read state for a specific channel for the current user.
     * Returns the unread count and last read information.
     */
    @GetMapping("/{channelId}/read-state")
    public ChannelReadStateResponse getReadState(@PathVariable UUID channelId) {
        UUID userId = CurrentUser.id();

        // Verify the user has access to this channel
        channelService.getChannel(channelId, userId);

        return channelReadStateService.getReadState(userId, channelId)
                .map(state -> new ChannelReadStateResponse(
                        state.getChannelId(),
                        state.getLastReadMessageId(),
                        state.getLastReadAt(),
                        state.getUnreadCount()
                ))
                .orElse(new ChannelReadStateResponse(
                        channelId,
                        null,
                        java.time.Instant.now(),
                        0
                ));
    }
}
