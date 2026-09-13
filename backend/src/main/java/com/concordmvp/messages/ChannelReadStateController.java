package com.concordmvp.messages;

import com.concordmvp.channels.ChannelService;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.dto.ChannelReadStateResponse;
import com.concordmvp.messages.dto.MarkChannelReadRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/channels")
public class ChannelReadStateController {

    private final ChannelReadStateService channelReadStateService;
    private final ChannelService channelService;

    public ChannelReadStateController(ChannelReadStateService channelReadStateService,
                                        ChannelService channelService) {
        this.channelReadStateService = channelReadStateService;
        this.channelService = channelService;
    }

    @PostMapping("/{channelId}/read")
    public ResponseEntity<Void> markChannelAsRead(
            @PathVariable UUID channelId,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody MarkChannelReadRequest request) {
        // Verify user is a member of the channel's server
        try {
            channelService.getChannel(channelId, userId);
        } catch (ResourceNotFoundException | ForbiddenException e) {
            throw new ForbiddenException("You don't have permission to access this channel");
        }

        channelReadStateService.markChannelAsRead(userId, channelId, request.lastReadMessageId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{channelId}/read-state")
    public ResponseEntity<ChannelReadStateResponse> getChannelReadState(
            @PathVariable UUID channelId,
            @AuthenticationPrincipal UUID userId) {
        // Verify user is a member of the channel's server
        try {
            channelService.getChannel(channelId, userId);
        } catch (ResourceNotFoundException | ForbiddenException e) {
            throw new ForbiddenException("You don't have permission to access this channel");
        }

        ChannelReadState state = channelReadStateService.getReadState(userId, channelId);
        if (state == null) {
            // Initialize read state if it doesn't exist
            state = channelReadStateService.initializeReadState(userId, channelId);
        }

        ChannelReadStateResponse response = new ChannelReadStateResponse(
            state.getId(),
            state.getUserId(),
            state.getChannelId(),
            state.getLastReadMessageId(),
            state.getLastReadAt(),
            state.getUnreadCount(),
            state.getCreatedAt(),
            state.getUpdatedAt()
        );

        return ResponseEntity.ok(response);
    }
}
