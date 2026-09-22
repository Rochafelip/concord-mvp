package com.concordmvp.permissions;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.servers.Server;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.servers.ServerRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The single place that answers "may this user do this here?". Every protected action goes
 * through it; nothing re-derives authorization from raw repositories any more.
 *
 * <p><b>Dependency rule:</b> this service depends only on repositories, never on
 * {@code ChannelService}, {@code MessageService}, {@code ServerService} or {@code MediaService} —
 * those depend on it, and going the other way would be a cycle. Reaching into another module's
 * repository for a read-only lookup is this project's established pattern (see the javadoc on
 * {@code ChannelService}).
 *
 * <p>No caching, deliberately: docs/DECISIONS.md D3 kept Redis out of the MVP and D1 scopes this
 * to a friends group. A cache here would need distributed invalidation, which is exactly what D3
 * avoided. Resolving a member costs two or three indexed queries.
 */
@Service
public class PermissionService {

    private final ServerRepository serverRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final ChannelRepository channelRepository;
    private final RoleRepository roleRepository;
    private final ChannelPermissionOverrideRepository overrideRepository;

    public PermissionService(ServerRepository serverRepository,
                              ServerMemberRepository serverMemberRepository,
                              ChannelRepository channelRepository,
                              RoleRepository roleRepository,
                              ChannelPermissionOverrideRepository overrideRepository) {
        this.serverRepository = serverRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.channelRepository = channelRepository;
        this.roleRepository = roleRepository;
        this.overrideRepository = overrideRepository;
    }

    // ------------------------------------------------------------------ server scope

    /** Effective permissions across the whole server, before any channel override. */
    public long serverPermissions(UUID serverId, UUID userId) {
        return resolve(serverId, userId).base();
    }

    public boolean hasServer(UUID serverId, UUID userId, Permission permission) {
        return PermissionSet.has(serverPermissions(serverId, userId), permission);
    }

    public void requireServer(UUID serverId, UUID userId, Permission permission) {
        if (!hasServer(serverId, userId, permission)) {
            throw new ForbiddenException(denialMessage(permission));
        }
    }

    // ------------------------------------------------------------------ channel scope

    public long channelPermissions(UUID channelId, UUID userId) {
        return channelPermissions(requireChannel(channelId), userId);
    }

    /** Overload for callers that already hold the channel, so it is not re-fetched. */
    public long channelPermissions(Channel channel, UUID userId) {
        MemberContext context = resolve(channel.getServerId(), userId);
        if (context.elevated() || !context.member()) {
            return context.base();
        }
        return applyOverrides(context, userId, overrideRepository.findByChannelId(channel.getId()));
    }

    public boolean hasChannel(UUID channelId, UUID userId, Permission permission) {
        return PermissionSet.has(channelPermissions(channelId, userId), permission);
    }

    public boolean hasChannel(Channel channel, UUID userId, Permission permission) {
        return PermissionSet.has(channelPermissions(channel, userId), permission);
    }

    public void requireChannel(UUID channelId, UUID userId, Permission permission) {
        requireChannel(requireChannel(channelId), userId, permission);
    }

    public void requireChannel(Channel channel, UUID userId, Permission permission) {
        if (!hasChannel(channel, userId, permission)) {
            throw new ForbiddenException(denialMessage(permission));
        }
    }

    /**
     * Enforces VIEW_CHANNEL as a 404 rather than a 403. A 403 would confirm that a channel the
     * user is not allowed to see exists at all, which leaks the server's structure.
     */
    public void requireVisible(Channel channel, UUID userId) {
        if (!hasChannel(channel, userId, Permission.VIEW_CHANNEL)) {
            throw new ResourceNotFoundException("Channel not found: " + channel.getId());
        }
    }

    /**
     * Keeps only the channels the user may see. Resolves the member once and fetches every
     * override in a single query, so listing N channels never becomes N lookups.
     */
    public List<Channel> filterVisible(List<Channel> channels, UUID serverId, UUID userId) {
        if (channels.isEmpty()) {
            return List.of();
        }
        MemberContext context = resolve(serverId, userId);
        if (context.elevated()) {
            return channels;
        }
        if (!context.member()) {
            return List.of();
        }

        List<UUID> channelIds = channels.stream().map(Channel::getId).toList();
        Map<UUID, List<ChannelPermissionOverride>> byChannel = new HashMap<>();
        for (ChannelPermissionOverride override : overrideRepository.findByChannelIdIn(channelIds)) {
            byChannel.computeIfAbsent(override.getChannelId(), key -> new ArrayList<>()).add(override);
        }

        List<Channel> visible = new ArrayList<>();
        for (Channel channel : channels) {
            long permissions = applyOverrides(context, userId,
                    byChannel.getOrDefault(channel.getId(), List.of()));
            if (PermissionSet.has(permissions, Permission.VIEW_CHANNEL)) {
                visible.add(channel);
            }
        }
        return visible;
    }

    /**
     * Which of the given candidates may actually see this channel — the set a realtime broadcast
     * for the channel is allowed to reach. Unlike {@link #filterVisible}, which fixes the user and
     * varies the channels, this fixes the channel and varies the users, so it fetches the
     * channel's overrides once rather than once per candidate.
     */
    public Set<UUID> visibleMemberIds(Channel channel, Set<UUID> candidateMemberIds) {
        if (candidateMemberIds.isEmpty()) {
            return Set.of();
        }

        List<ChannelPermissionOverride> overrides = overrideRepository.findByChannelId(channel.getId());
        Set<UUID> visible = new HashSet<>();
        for (UUID userId : candidateMemberIds) {
            MemberContext context = resolve(channel.getServerId(), userId);
            long permissions = context.elevated() || !context.member()
                    ? context.base()
                    : applyOverrides(context, userId, overrides);
            if (PermissionSet.has(permissions, Permission.VIEW_CHANNEL)) {
                visible.add(userId);
            }
        }
        return visible;
    }

    // ------------------------------------------------------------------ hierarchy

    /**
     * The member's rank: the highest {@code position} among its roles, {@code Integer.MAX_VALUE}
     * for the owner, {@code Integer.MIN_VALUE} for a non-member. An ADMINISTRATOR is deliberately
     * <em>not</em> elevated here — otherwise two administrators could remove each other.
     */
    public int highestPosition(UUID serverId, UUID userId) {
        return resolve(serverId, userId).highestPosition();
    }

    /** True when the actor outranks the target strictly, which is what managing anything requires. */
    public boolean outranks(UUID serverId, UUID actorId, UUID targetUserId) {
        return highestPosition(serverId, actorId) > highestPosition(serverId, targetUserId);
    }

    // ------------------------------------------------------------------ internals

    /**
     * Everything needed to answer any question about one member, gathered in one pass so a
     * caller that asks about several channels pays for it once.
     */
    record MemberContext(boolean elevated, boolean member, long base, int highestPosition,
                         Set<UUID> roleIds, UUID everyoneRoleId) {

        static MemberContext outsider() {
            return new MemberContext(false, false, 0L, Integer.MIN_VALUE, Set.of(), null);
        }

        static MemberContext owner() {
            return new MemberContext(true, true, Permission.ALL, Integer.MAX_VALUE, Set.of(), null);
        }
    }

    MemberContext resolve(UUID serverId, UUID userId) {
        Server server = serverRepository.findById(serverId)
                .orElseThrow(() -> new ResourceNotFoundException("Server not found: " + serverId));

        if (server.getOwnerId().equals(userId)) {
            return MemberContext.owner();
        }

        Optional<ServerMember> membership = serverMemberRepository.findByServerIdAndUserId(serverId, userId);
        if (membership.isEmpty()) {
            return MemberContext.outsider();
        }

        List<Role> roles = roleRepository.findEffectiveRoles(serverId, membership.get().getId());
        long base = 0L;
        int highestPosition = 0;
        Set<UUID> roleIds = new HashSet<>();
        UUID everyoneRoleId = null;
        for (Role role : roles) {
            base |= role.getPermissions();
            highestPosition = Math.max(highestPosition, role.getPosition());
            roleIds.add(role.getId());
            if (role.isEveryone()) {
                everyoneRoleId = role.getId();
            }
        }

        if (PermissionSet.has(base, Permission.ADMINISTRATOR)) {
            // Wide access, but still bound by the hierarchy — hence elevated with the real position.
            return new MemberContext(true, true, Permission.ALL, highestPosition, roleIds, everyoneRoleId);
        }
        return new MemberContext(false, true, base, highestPosition, roleIds, everyoneRoleId);
    }

    /**
     * Precedence, straight from the spec: {@code @everyone} override, then the union of the
     * member's role overrides, then the member's own override. Roles are aggregated <em>before</em>
     * being applied, so an allow on any one role beats a deny on another.
     *
     * <p>Both sides are masked with {@link Permission#CHANNEL_SCOPED}: a channel override can never
     * hand out ADMINISTRATOR or MANAGE_ROLES, whatever the stored row happens to contain.
     */
    private long applyOverrides(MemberContext context, UUID userId,
                                 List<ChannelPermissionOverride> overrides) {
        long everyoneAllow = 0L, everyoneDeny = 0L;
        long roleAllow = 0L, roleDeny = 0L;
        long userAllow = 0L, userDeny = 0L;

        for (ChannelPermissionOverride override : overrides) {
            long allow = override.getAllow() & Permission.CHANNEL_SCOPED;
            long deny = override.getDeny() & Permission.CHANNEL_SCOPED;

            if (override.getUserId() != null) {
                if (override.getUserId().equals(userId)) {
                    userAllow |= allow;
                    userDeny |= deny;
                }
            } else if (override.getRoleId() != null) {
                if (override.getRoleId().equals(context.everyoneRoleId())) {
                    everyoneAllow |= allow;
                    everyoneDeny |= deny;
                } else if (context.roleIds().contains(override.getRoleId())) {
                    roleAllow |= allow;
                    roleDeny |= deny;
                }
            }
        }

        long permissions = context.base();
        permissions = (permissions & ~everyoneDeny) | everyoneAllow;
        permissions = (permissions & ~roleDeny) | roleAllow;
        permissions = (permissions & ~userDeny) | userAllow;
        return permissions;
    }

    private Channel requireChannel(UUID channelId) {
        return channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel not found: " + channelId));
    }

    private static String denialMessage(Permission permission) {
        return "Você não tem permissão para esta ação (" + permission.name() + ")";
    }
}
