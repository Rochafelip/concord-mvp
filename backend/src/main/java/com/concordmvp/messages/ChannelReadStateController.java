package com.concordmvp.messages;

import com.concordmvp.channels.ChannelService;
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
        // Same visibility check as reading messages: 404 (not 403) for a channel the requester
        // can't see, so it doesn't confirm the channel exists — letting getChannel's exception
        // propagate as-is is what keeps that distinction (see ChannelService.getChannel).
        channelService.getChannel(channelId, userId);

        channelReadStateService.markChannelAsRead(userId, channelId, request.lastReadMessageId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{channelId}/read-state")
    public ResponseEntity<ChannelReadStateResponse> getChannelReadState(
            @PathVariable UUID channelId,
            @AuthenticationPrincipal UUID userId) {
        channelService.getChannel(channelId, userId);

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
