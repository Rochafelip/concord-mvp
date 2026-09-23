package com.concordmvp.servers;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.permissions.PermissionSet;
import com.concordmvp.servers.dto.CreateServerRequest;
import com.concordmvp.servers.dto.InviteResponse;
import com.concordmvp.servers.dto.JoinServerRequest;
import com.concordmvp.servers.dto.ServerMemberResponse;
import com.concordmvp.servers.dto.ServerResponse;
import com.concordmvp.servers.dto.TransferOwnershipRequest;
import com.concordmvp.servers.dto.UpdateServerMemberRequest;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.UserAvatarUrls;
import com.concordmvp.users.dto.UserSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/servers")
public class ServerController {

    private final ServerService serverService;
    private final UserRepository userRepository;
    private final PermissionService permissionService;
    private final ServerIconStorageService serverIconStorageService;

    public ServerController(ServerService serverService, UserRepository userRepository,
                             PermissionService permissionService, ServerIconStorageService serverIconStorageService) {
        this.permissionService = permissionService;
        this.serverService = serverService;
        this.userRepository = userRepository;
        this.serverIconStorageService = serverIconStorageService;
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

    @PatchMapping("/{id}/members/me")
    public ServerMemberResponse updateMyMemberDisplayName(@PathVariable UUID id,
                                                           @Valid @RequestBody UpdateServerMemberRequest request) {
        ServerMember member = serverService.updateMemberDisplayName(id, CurrentUser.id(), request.displayName());
        return toMemberResponse(member);
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

    @PutMapping(value = "/{id}/icon", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ServerResponse uploadIcon(@PathVariable UUID id, @RequestParam("file") MultipartFile file) {
        Server server = serverService.updateIcon(id, CurrentUser.id(), file);
        return toResponse(server);
    }

    @DeleteMapping("/{id}/icon")
    public ServerResponse deleteIcon(@PathVariable UUID id) {
        Server server = serverService.removeIcon(id, CurrentUser.id());
        return toResponse(server);
    }

    @GetMapping("/{id}/icon")
    public ResponseEntity<byte[]> icon(@PathVariable UUID id) {
        Server server = serverService.getServer(id, CurrentUser.id());
        if (server.getIconStorageKey() == null) return ResponseEntity.notFound().build();
        try {
            Path path = serverIconStorageService.resolve(server.getIconStorageKey());
            if (!Files.exists(path)) return ResponseEntity.notFound().build();
            String contentType = Files.probeContentType(path);
            MediaType mediaType = contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
            return ResponseEntity.ok().contentType(mediaType)
                    .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                    .body(Files.readAllBytes(path));
        } catch (IOException ex) {
            throw new com.concordmvp.common.exception.ResourceNotFoundException("Server icon not found");
        }
    }

    /**
     * Carries the requester's own effective permissions so the UI can hide actions it would only
     * get a 403 for. Convenience, never enforcement — that lives in the services.
     */
    private ServerResponse toResponse(Server server) {
        return new ServerResponse(server.getId(), server.getName(), server.getOwnerId(),
                server.getCreatedAt(), server.getUpdatedAt(), ServerIconUrls.url(server),
                PermissionSet.toNames(permissionService.serverPermissions(server.getId(), CurrentUser.id())));
    }

    private ServerMemberResponse toMemberResponse(ServerMember member) {
        User user = userRepository.findById(member.getUserId())
                .orElseThrow(() -> new IllegalStateException("Member references missing user: " + member.getUserId()));
        UserSummaryResponse summary = new UserSummaryResponse(user.getId(), user.getUsername(),
                user.getDisplayName(), UserAvatarUrls.url(user));
        return new ServerMemberResponse(summary, serverService.effectiveDisplayName(member, user), member.getJoinedAt());
    }
}
