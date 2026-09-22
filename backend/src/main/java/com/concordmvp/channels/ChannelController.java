package com.concordmvp.channels;

import com.concordmvp.channels.dto.ChannelResponse;
import com.concordmvp.channels.dto.CreateChannelRequest;
import com.concordmvp.common.CurrentUser;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.permissions.PermissionSet;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class ChannelController {

    private final ChannelService channelService;
    private final PermissionService permissionService;

    public ChannelController(ChannelService channelService, PermissionService permissionService) {
        this.channelService = channelService;
        this.permissionService = permissionService;
    }

    @GetMapping("/api/v1/servers/{serverId}/channels")
    public List<ChannelResponse> listChannels(@PathVariable UUID serverId) {
        UUID requesterId = CurrentUser.id();
        return channelService.listChannels(serverId, requesterId).stream()
                .map(channel -> toResponse(channel, requesterId))
                .toList();
    }

    @PostMapping("/api/v1/servers/{serverId}/channels")
    public ResponseEntity<ChannelResponse> createChannel(@PathVariable UUID serverId,
                                                           @Valid @RequestBody CreateChannelRequest request) {
        UUID requesterId = CurrentUser.id();
        Channel channel = channelService.createChannel(serverId, request.name(), request.type(), requesterId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(channel, requesterId));
    }

    @GetMapping("/api/v1/channels/{channelId}")
    public ChannelResponse getChannel(@PathVariable UUID channelId) {
        UUID requesterId = CurrentUser.id();
        Channel channel = channelService.getChannel(channelId, requesterId);
        return toResponse(channel, requesterId);
    }

    @DeleteMapping("/api/v1/channels/{channelId}")
    public ResponseEntity<Void> deleteChannel(@PathVariable UUID channelId) {
        channelService.deleteChannel(channelId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    /**
     * Carries the requester's own effective permissions so the UI can hide actions it would only
     * get a 403 for. It is a convenience, never the enforcement — that lives in the services.
     */
    private ChannelResponse toResponse(Channel channel, UUID requesterId) {
        return new ChannelResponse(channel.getId(), channel.getServerId(), channel.getName(),
                channel.getType(), channel.getCreatedAt(), channel.getUpdatedAt(), null,
                PermissionSet.toNames(permissionService.channelPermissions(channel, requesterId)));
    }
}
