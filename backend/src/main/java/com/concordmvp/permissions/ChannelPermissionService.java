package com.concordmvp.permissions;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.permissions.dto.PermissionsUpdatePayload;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Per-channel exceptions to the server-wide permissions. Kept apart from {@link RoleService}
 * because the two answer different questions — "what does this role grant everywhere?" versus
 * "what changes inside this one channel?" — and neither needs the other's internals.
 *
 * <p>Writing an override is always MANAGE_ROLES: an override is a permission grant, so letting
 * MANAGE_CHANNELS alone write one would make channel management a way around the role hierarchy.
 * Reading is looser, since someone managing a channel needs to see why it is configured as it is.
 */
@Service
public class ChannelPermissionService {

    private final ChannelRepository channelRepository;
    private final ChannelPermissionOverrideRepository overrideRepository;
    private final RoleRepository roleRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final PermissionService permissionService;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public ChannelPermissionService(ChannelRepository channelRepository,
                                     ChannelPermissionOverrideRepository overrideRepository,
                                     RoleRepository roleRepository,
                                     ServerMemberRepository serverMemberRepository,
                                     PermissionService permissionService,
                                     RealtimeEventPublisher realtimeEventPublisher) {
        this.channelRepository = channelRepository;
        this.overrideRepository = overrideRepository;
        this.roleRepository = roleRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.permissionService = permissionService;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    public List<ChannelPermissionOverride> listOverrides(UUID channelId, UUID requesterId) {
        Channel channel = requireChannel(channelId);
        UUID serverId = channel.getServerId();
        boolean allowed = permissionService.hasServer(serverId, requesterId, Permission.MANAGE_ROLES)
                || permissionService.hasServer(serverId, requesterId, Permission.MANAGE_CHANNELS);
        if (!allowed) {
            throw new ForbiddenException("Você não tem permissão para ver as permissões deste canal");
        }
        return overrideRepository.findByChannelId(channelId);
    }

    /** @return the stored override, or null when it was empty and therefore removed/not created. */
    @Transactional
    public ChannelPermissionOverride upsertRoleOverride(UUID channelId, UUID roleId,
                                                         Set<Permission> allow, Set<Permission> deny,
                                                         UUID requesterId) {
        Channel channel = requireChannel(channelId);
        UUID serverId = channel.getServerId();
        long allowBits = validate(serverId, requesterId, allow, deny);
        long denyBits = PermissionSet.toBitmask(deny);

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + roleId));
        if (!role.getServerId().equals(serverId)) {
            throw new ResourceNotFoundException("Role not found: " + roleId);
        }
        if (permissionService.highestPosition(serverId, requesterId) <= role.getPosition()) {
            throw new ForbiddenException(
                    "Você não pode alterar as permissões de um cargo no seu nível ou acima: " + role.getName());
        }

        ChannelPermissionOverride result = store(
                overrideRepository.findByChannelIdAndRoleId(channelId, roleId),
                () -> ChannelPermissionOverride.forRole(channelId, roleId, allowBits, denyBits),
                allowBits, denyBits);

        // Whoever holds the role is affected, but so is anyone whose view of the channel list
        // depends on it. Notifying the server is one refetch and avoids getting that set wrong.
        notify(serverId, serverMemberIds(serverId));
        return result;
    }

    @Transactional
    public ChannelPermissionOverride upsertUserOverride(UUID channelId, UUID userId,
                                                         Set<Permission> allow, Set<Permission> deny,
                                                         UUID requesterId) {
        Channel channel = requireChannel(channelId);
        UUID serverId = channel.getServerId();
        long allowBits = validate(serverId, requesterId, allow, deny);
        long denyBits = PermissionSet.toBitmask(deny);

        if (permissionService.highestPosition(serverId, requesterId)
                <= permissionService.highestPosition(serverId, userId)) {
            throw new ForbiddenException("Você não pode alterar as permissões de alguém no seu nível ou acima");
        }
        requireMembership(serverId, userId);

        ChannelPermissionOverride result = store(
                overrideRepository.findByChannelIdAndUserId(channelId, userId),
                () -> ChannelPermissionOverride.forUser(channelId, userId, allowBits, denyBits),
                allowBits, denyBits);

        notify(serverId, Set.of(userId));
        return result;
    }

    @Transactional
    public void deleteOverride(UUID channelId, UUID overrideId, UUID requesterId) {
        Channel channel = requireChannel(channelId);
        UUID serverId = channel.getServerId();
        if (!permissionService.hasServer(serverId, requesterId, Permission.MANAGE_ROLES)) {
            throw new ForbiddenException("Você não tem permissão para gerenciar permissões de canal");
        }

        ChannelPermissionOverride override = overrideRepository.findById(overrideId)
                .orElseThrow(() -> new ResourceNotFoundException("Override not found: " + overrideId));
        if (!override.getChannelId().equals(channelId)) {
            throw new ResourceNotFoundException("Override not found: " + overrideId);
        }

        overrideRepository.delete(override);
        notify(serverId, serverMemberIds(serverId));
    }

    // ------------------------------------------------------------------ internals

    /**
     * Shared checks for both override kinds.
     *
     * @return the allow bitmask, already validated
     */
    private long validate(UUID serverId, UUID requesterId, Set<Permission> allow, Set<Permission> deny) {
        if (!permissionService.hasServer(serverId, requesterId, Permission.MANAGE_ROLES)) {
            throw new ForbiddenException("Você não tem permissão para gerenciar permissões de canal");
        }

        long allowBits = PermissionSet.toBitmask(allow);
        long denyBits = PermissionSet.toBitmask(deny);

        long outOfScope = (allowBits | denyBits) & ~Permission.CHANNEL_SCOPED;
        if (outOfScope != 0) {
            throw new BadRequestException(
                    "Estas permissões não podem ser definidas por canal: " + PermissionSet.toNames(outOfScope));
        }

        long contradictory = allowBits & denyBits;
        if (contradictory != 0) {
            throw new BadRequestException(
                    "Uma permissão não pode ser permitida e negada ao mesmo tempo: "
                            + PermissionSet.toNames(contradictory));
        }

        // Only the allow side can escalate; denying something you do not have is never a gain.
        long missing = allowBits & ~permissionService.serverPermissions(serverId, requesterId);
        if (missing != 0) {
            throw new ForbiddenException(
                    "Você não pode conceder permissões que não possui: " + PermissionSet.toNames(missing));
        }
        return allowBits;
    }

    /** An override that neither allows nor denies anything is a no-op row, so it is removed instead. */
    private ChannelPermissionOverride store(Optional<ChannelPermissionOverride> existing,
                                             java.util.function.Supplier<ChannelPermissionOverride> factory,
                                             long allowBits, long denyBits) {
        if (allowBits == 0 && denyBits == 0) {
            existing.ifPresent(overrideRepository::delete);
            return null;
        }
        ChannelPermissionOverride override = existing.orElseGet(factory);
        override.setAllow(allowBits);
        override.setDeny(denyBits);
        return overrideRepository.save(override);
    }

    private Channel requireChannel(UUID channelId) {
        return channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel not found: " + channelId));
    }

    private void requireMembership(UUID serverId, UUID userId) {
        serverMemberRepository.findByServerIdAndUserId(serverId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Not a member of this server: " + userId));
    }

    private Set<UUID> serverMemberIds(UUID serverId) {
        return serverMemberRepository.findByServerId(serverId).stream()
                .map(ServerMember::getUserId)
                .collect(Collectors.toSet());
    }

    private void notify(UUID serverId, Set<UUID> recipients) {
        if (recipients.isEmpty()) {
            return;
        }
        realtimeEventPublisher.broadcast(recipients,
                new WsEvent(WsEventType.PERMISSIONS_UPDATE, new PermissionsUpdatePayload(serverId)));
    }
}
