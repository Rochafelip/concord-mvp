package com.concordmvp.servers;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.servers.dto.CreateServerRequest;
import com.concordmvp.servers.dto.InviteResponse;
import com.concordmvp.servers.dto.JoinServerRequest;
import com.concordmvp.servers.dto.ServerMemberResponse;
import com.concordmvp.servers.dto.ServerResponse;
import com.concordmvp.servers.dto.TransferOwnershipRequest;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.dto.UserSummaryResponse;
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
@RequestMapping("/api/v1/servers")
public class ServerController {

    private final ServerService serverService;
    private final UserRepository userRepository;

    public ServerController(ServerService serverService, UserRepository userRepository) {
        this.serverService = serverService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<ServerResponse> createServer(@Valid @RequestBody CreateServerRequest request) {
        Server server = serverService.createServer(request.name(), CurrentUser.id());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(server));
    }

    @GetMapping
    public List<ServerResponse> listServers() {
        return serverService.listServersForUser(CurrentUser.id()).stream()
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/{id}")
    public ServerResponse getServer(@PathVariable UUID id) {
        Server server = serverService.getServer(id, CurrentUser.id());
        return toResponse(server);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteServer(@PathVariable UUID id) {
        serverService.deleteServer(id, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Void> leaveServer(@PathVariable UUID id) {
        serverService.leaveServer(id, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    public List<ServerMemberResponse> listMembers(@PathVariable UUID id) {
        List<ServerMember> members = serverService.listMembers(id, CurrentUser.id());
        return members.stream()
                .map(this::toMemberResponse)
                .toList();
    }

    @PostMapping("/{id}/transfer-ownership")
    public ServerResponse transferOwnership(@PathVariable UUID id, @Valid @RequestBody TransferOwnershipRequest request) {
        Server server = serverService.transferOwnership(id, request.newOwnerId(), CurrentUser.id());
        return toResponse(server);
    }

    @GetMapping("/{id}/invite")
    public InviteResponse getInvite(@PathVariable UUID id) {
        ServerInvite invite = serverService.getOrCreateInvite(id, CurrentUser.id());
        return new InviteResponse(invite.getCode());
    }

    @PostMapping("/{id}/invite/regenerate")
    public InviteResponse regenerateInvite(@PathVariable UUID id) {
        ServerInvite invite = serverService.regenerateInvite(id, CurrentUser.id());
        return new InviteResponse(invite.getCode());
    }

    @PostMapping("/join")
    public ServerResponse joinServer(@Valid @RequestBody JoinServerRequest request) {
        Server server = serverService.joinServer(request.code(), CurrentUser.id());
        return toResponse(server);
    }

    private ServerResponse toResponse(Server server) {
        return new ServerResponse(server.getId(), server.getName(), server.getOwnerId(),
                server.getCreatedAt(), server.getUpdatedAt());
    }

    private ServerMemberResponse toMemberResponse(ServerMember member) {
        User user = userRepository.findById(member.getUserId())
                .orElseThrow(() -> new IllegalStateException("Member references missing user: " + member.getUserId()));
        UserSummaryResponse summary = new UserSummaryResponse(user.getId(), user.getUsername(),
                user.getDisplayName(), user.getAvatarUrl());
        return new ServerMemberResponse(summary, member.getJoinedAt());
    }
}
