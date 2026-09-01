package com.concordmvp.channels;

import com.concordmvp.channels.dto.ChannelResponse;
import com.concordmvp.channels.dto.CreateChannelRequest;
import com.concordmvp.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    public ChannelController(ChannelService channelService) {
        this.channelService = channelService;
    }

    @GetMapping("/api/v1/servers/{serverId}/channels")
    public List<ChannelResponse> listChannels(@PathVariable UUID serverId) {
        return channelService.listChannels(serverId, CurrentUser.id()).stream()
                .map(this::toResponse)
                .toList();
    }

    @PostMapping("/api/v1/servers/{serverId}/channels")
    public ResponseEntity<ChannelResponse> createChannel(@PathVariable UUID serverId,
                                                           @Valid @RequestBody CreateChannelRequest request) {
        Channel channel = channelService.createChannel(serverId, request.name(), request.type(), CurrentUser.id());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(channel));
    }

    @GetMapping("/api/v1/channels/{channelId}")
    public ChannelResponse getChannel(@PathVariable UUID channelId) {
        Channel channel = channelService.getChannel(channelId, CurrentUser.id());
        return toResponse(channel);
    }

    private ChannelResponse toResponse(Channel channel) {
        return new ChannelResponse(channel.getId(), channel.getServerId(), channel.getName(),
                channel.getType(), channel.getCreatedAt(), channel.getUpdatedAt());
    }
}
