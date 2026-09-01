package com.concordmvp.servers;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.dto.ServerDeletedPayload;
import com.concordmvp.servers.dto.ServerMemberEventPayload;
import com.concordmvp.servers.dto.ServerOwnerChangePayload;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Business logic for servers, membership, ownership and invites. Free of any HTTP/security
 * concerns — the acting user's id is always passed in explicitly by the caller (the controller),
 * which reads it via {@link com.concordmvp.common.CurrentUser}.
 */
@Service
public class ServerService {

    private static final String INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int INVITE_CODE_LENGTH = 10;

    private final ServerRepository serverRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final ServerInviteRepository serverInviteRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final SecureRandom secureRandom = new SecureRandom();

    public ServerService(ServerRepository serverRepository,
                          ServerMemberRepository serverMemberRepository,
                          ServerInviteRepository serverInviteRepository,
                          RealtimeEventPublisher realtimeEventPublisher) {
        this.serverRepository = serverRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.serverInviteRepository = serverInviteRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    @Transactional
    public Server createServer(String name, UUID ownerId) {
        Server server = new Server();
        server.setName(name);
        server.setOwnerId(ownerId);
        Server saved = serverRepository.save(server);

        ServerMember ownerMembership = new ServerMember();
        ownerMembership.setServerId(saved.getId());
        ownerMembership.setUserId(ownerId);
        serverMemberRepository.save(ownerMembership);

        return saved;
    }

    public List<Server> listServersForUser(UUID userId) {
        List<UUID> serverIds = serverMemberRepository.findByUserId(userId).stream()
                .map(ServerMember::getServerId)
                .toList();
        return serverRepository.findAllById(serverIds);
    }

    public Server getServer(UUID serverId, UUID requesterId) {
        Server server = requireServer(serverId);
        requireMember(serverId, requesterId);
        return server;
    }

    public List<ServerMember> listMembers(UUID serverId, UUID requesterId) {
        requireServer(serverId);
        requireMember(serverId, requesterId);
        return serverMemberRepository.findByServerId(serverId);
    }

    @Transactional
    public Server joinServer(String code, UUID userId) {
        ServerInvite invite = serverInviteRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid invite code"));
        UUID serverId = invite.getServerId();
        Server server = requireServer(serverId);

        if (serverMemberRepository.existsByServerIdAndUserId(serverId, userId)) {
            return server;
        }

        ServerMember member = new ServerMember();
        member.setServerId(serverId);
        member.setUserId(userId);
        serverMemberRepository.save(member);

        Set<UUID> recipients = currentMemberIds(serverId);
        realtimeEventPublisher.broadcast(recipients,
                new WsEvent(WsEventType.SERVER_MEMBER_JOIN, new ServerMemberEventPayload(serverId, userId)));

        return server;
    }

    @Transactional
    public void leaveServer(UUID serverId, UUID userId) {
        Server server = requireServer(serverId);

        if (server.getOwnerId().equals(userId)) {
            throw new ForbiddenException("The server owner cannot leave without transferring ownership or deleting the server first");
        }

        ServerMember membership = serverMemberRepository.findByServerIdAndUserId(serverId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Not a member of this server"));

        serverMemberRepository.delete(membership);

        Set<UUID> remainingRecipients = currentMemberIds(serverId);
        realtimeEventPublisher.broadcast(remainingRecipients,
                new WsEvent(WsEventType.SERVER_MEMBER_LEAVE, new ServerMemberEventPayload(serverId, userId)));
    }

    @Transactional
    public Server transferOwnership(UUID serverId, UUID newOwnerId, UUID requesterId) {
        Server server = requireServer(serverId);

        if (!server.getOwnerId().equals(requesterId)) {
            throw new ForbiddenException("Only the current owner can transfer ownership");
        }

        if (!serverMemberRepository.existsByServerIdAndUserId(serverId, newOwnerId)) {
            throw new BadRequestException("The new owner must already be a member of this server");
        }

        server.setOwnerId(newOwnerId);
        Server saved = serverRepository.save(server);

        Set<UUID> recipients = currentMemberIds(serverId);
        realtimeEventPublisher.broadcast(recipients,
                new WsEvent(WsEventType.SERVER_OWNER_CHANGE, new ServerOwnerChangePayload(serverId, newOwnerId)));

        return saved;
    }

    @Transactional
    public void deleteServer(UUID serverId, UUID requesterId) {
        Server server = requireServer(serverId);

        if (!server.getOwnerId().equals(requesterId)) {
            throw new ForbiddenException("Only the current owner can delete this server");
        }

        Set<UUID> recipients = currentMemberIds(serverId);
        realtimeEventPublisher.broadcast(recipients,
                new WsEvent(WsEventType.SERVER_DELETE, new ServerDeletedPayload(serverId)));

        // TODO(Task 5): delete this server's channels here, before deleting members/invite/server.
        // TODO(Task 6): delete those channels' messages here too, before deleting the channels.

        serverInviteRepository.findByServerId(serverId).ifPresent(serverInviteRepository::delete);
        serverMemberRepository.deleteAll(serverMemberRepository.findByServerId(serverId));
        serverRepository.delete(server);
    }

    public ServerInvite getOrCreateInvite(UUID serverId, UUID requesterId) {
        Server server = requireServer(serverId);
        requireOwner(server, requesterId);

        return serverInviteRepository.findByServerId(serverId)
                .orElseGet(() -> createInvite(serverId));
    }

    @Transactional
    public ServerInvite regenerateInvite(UUID serverId, UUID requesterId) {
        Server server = requireServer(serverId);
        requireOwner(server, requesterId);

        return serverInviteRepository.findByServerId(serverId)
                .map(invite -> {
                    invite.setCode(generateInviteCode());
                    return serverInviteRepository.save(invite);
                })
                .orElseGet(() -> createInvite(serverId));
    }

    private ServerInvite createInvite(UUID serverId) {
        ServerInvite invite = new ServerInvite();
        invite.setServerId(serverId);
        invite.setCode(generateInviteCode());
        return serverInviteRepository.save(invite);
    }

    private Server requireServer(UUID serverId) {
        return serverRepository.findById(serverId)
                .orElseThrow(() -> new ResourceNotFoundException("Server not found: " + serverId));
    }

    private void requireMember(UUID serverId, UUID userId) {
        if (!serverMemberRepository.existsByServerIdAndUserId(serverId, userId)) {
            throw new ForbiddenException("Not a member of this server");
        }
    }

    private void requireOwner(Server server, UUID requesterId) {
        if (!server.getOwnerId().equals(requesterId)) {
            throw new ForbiddenException("Only the server owner can perform this action");
        }
    }

    private Set<UUID> currentMemberIds(UUID serverId) {
        return serverMemberRepository.findByServerId(serverId).stream()
                .map(ServerMember::getUserId)
                .collect(Collectors.toSet());
    }

    private String generateInviteCode() {
        StringBuilder sb = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            sb.append(INVITE_CODE_ALPHABET.charAt(secureRandom.nextInt(INVITE_CODE_ALPHABET.length())));
        }
        return sb.toString();
    }
}
