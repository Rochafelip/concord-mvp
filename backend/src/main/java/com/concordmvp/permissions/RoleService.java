package com.concordmvp.permissions;

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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Creating, editing, ordering and assigning roles. Free of HTTP concerns — the acting user's id is
 * always passed in by the controller, same as {@code ServerService}.
 *
 * <p>Two rules run through every mutation here:
 * <ul>
 *   <li><b>Hierarchy.</b> You may only touch a role, or a member, strictly below your own rank.
 *       The owner is exempt; an ADMINISTRATOR is not, or two of them could remove each other.</li>
 *   <li><b>No self-elevation.</b> You may not grant a permission you do not hold, otherwise
 *       MANAGE_ROLES would quietly be equivalent to ADMINISTRATOR.</li>
 * </ul>
 */
@Service
public class RoleService {

    private static final String EVERYONE_NAME = "@everyone";
    private static final int EVERYONE_POSITION = 0;
    private static final int DEFAULT_POSITION = 1;
    private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private final RoleRepository roleRepository;
    private final MemberRoleRepository memberRoleRepository;
    private final ChannelPermissionOverrideRepository overrideRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final PermissionService permissionService;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public RoleService(RoleRepository roleRepository,
                        MemberRoleRepository memberRoleRepository,
                        ChannelPermissionOverrideRepository overrideRepository,
                        ServerMemberRepository serverMemberRepository,
                        PermissionService permissionService,
                        RealtimeEventPublisher realtimeEventPublisher) {
        this.roleRepository = roleRepository;
        this.memberRoleRepository = memberRoleRepository;
        this.overrideRepository = overrideRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.permissionService = permissionService;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    // ------------------------------------------------------------------ reads

    public List<Role> listRoles(UUID serverId, UUID requesterId) {
        if (!serverMemberRepository.existsByServerIdAndUserId(serverId, requesterId)) {
            throw new ForbiddenException("Not a member of this server");
        }
        return roleRepository.findByServerIdOrderByPositionDescNameAsc(serverId);
    }

    public List<Role> listMemberRoles(UUID serverId, UUID userId, UUID requesterId) {
        permissionService.requireServer(serverId, requesterId, Permission.VIEW_MEMBER_LIST);
        ServerMember membership = requireMembership(serverId, userId);
        return roleRepository.findEffectiveRoles(serverId, membership.getId());
    }

    // ------------------------------------------------------------------ bootstrapping

    /**
     * The {@code @everyone} every server needs. Called inside {@code ServerService.createServer}'s
     * transaction; migration V18 did the same in SQL for servers that already existed, with the
     * same default permissions.
     */
    @Transactional
    public Role createEveryoneRole(UUID serverId) {
        Role role = new Role();
        role.setServerId(serverId);
        role.setName(EVERYONE_NAME);
        role.setPosition(EVERYONE_POSITION);
        role.setPermissions(Permission.EVERYONE_DEFAULT);
        role.setEveryone(true);
        return roleRepository.save(role);
    }

    // ------------------------------------------------------------------ mutations

    @Transactional
    public Role createRole(UUID serverId, RoleDraft draft, UUID requesterId) {
        requireManageRoles(serverId, requesterId);

        String name = requireValidName(draft.name());
        String color = requireValidColor(draft.color());
        int position = draft.position() == null ? DEFAULT_POSITION : draft.position();
        long permissions = PermissionSet.toBitmask(draft.permissions());

        requireBelowActor(serverId, requesterId, position);
        requireActorHolds(serverId, requesterId, permissions);

        Role role = new Role();
        role.setServerId(serverId);
        role.setName(name);
        role.setDescription(draft.description());
        role.setColor(color);
        role.setPosition(position);
        role.setPermissions(permissions);
        role.setEveryone(false);

        // No broadcast: a role nobody holds yet changes nothing for anybody.
        return roleRepository.save(role);
    }

    @Transactional
    public Role updateRole(UUID roleId, RoleDraft draft, UUID requesterId) {
        Role role = requireRole(roleId);
        UUID serverId = role.getServerId();
        requireManageRoles(serverId, requesterId);
        requireCanManage(role, requesterId);

        if (draft.name() != null) {
            if (role.isEveryone()) {
                throw new BadRequestException("O cargo @everyone não pode ser renomeado");
            }
            role.setName(requireValidName(draft.name()));
        }
        if (draft.description() != null) {
            role.setDescription(draft.description().isBlank() ? null : draft.description());
        }
        if (draft.color() != null) {
            role.setColor(draft.color().isBlank() ? null : requireValidColor(draft.color()));
        }
        if (draft.position() != null) {
            if (role.isEveryone()) {
                throw new BadRequestException("O cargo @everyone é sempre a base da hierarquia");
            }
            requireBelowActor(serverId, requesterId, draft.position());
            role.setPosition(draft.position());
        }
        if (draft.permissions() != null) {
            long permissions = PermissionSet.toBitmask(draft.permissions());
            requireActorHolds(serverId, requesterId, permissions);
            role.setPermissions(permissions);
        }

        Role saved = roleRepository.save(role);
        notify(serverId, affectedBy(saved));
        return saved;
    }

    @Transactional
    public void deleteRole(UUID roleId, UUID requesterId) {
        Role role = requireRole(roleId);
        if (role.isEveryone()) {
            throw new BadRequestException("O cargo @everyone não pode ser excluído");
        }
        UUID serverId = role.getServerId();
        requireManageRoles(serverId, requesterId);
        requireCanManage(role, requesterId);

        // Collected before the delete: afterwards there is no way to know who held it.
        Set<UUID> affected = affectedBy(role);

        memberRoleRepository.deleteByRoleId(roleId);
        overrideRepository.deleteByRoleId(roleId);
        roleRepository.delete(role);

        notify(serverId, affected);
    }

    /**
     * Reorders in one batch rather than one request per role: two concurrent single-role moves
     * would interleave and leave the hierarchy in a state neither caller asked for.
     */
    @Transactional
    public void updatePositions(UUID serverId, List<RolePosition> positions, UUID requesterId) {
        requireManageRoles(serverId, requesterId);

        for (RolePosition entry : positions) {
            Role role = requireRole(entry.roleId());
            requireSameServer(role, serverId);
            if (role.isEveryone()) {
                throw new BadRequestException("O cargo @everyone é sempre a base da hierarquia");
            }
            requireCanManage(role, requesterId);
            requireBelowActor(serverId, requesterId, entry.position());
            role.setPosition(entry.position());
            roleRepository.save(role);
        }

        // Everyone's relative standing may have changed, so everyone refetches.
        notify(serverId, serverMemberIds(serverId));
    }

    @Transactional
    public void assignRole(UUID serverId, UUID userId, UUID roleId, UUID requesterId) {
        Role role = requireAssignableRole(serverId, roleId, requesterId);
        ServerMember membership = requireManageableMember(serverId, userId, requesterId);

        if (memberRoleRepository.existsByServerMemberIdAndRoleId(membership.getId(), role.getId())) {
            return;
        }
        memberRoleRepository.save(new MemberRole(membership.getId(), role.getId()));
        notify(serverId, Set.of(userId));
    }

    @Transactional
    public void unassignRole(UUID serverId, UUID userId, UUID roleId, UUID requesterId) {
        Role role = requireAssignableRole(serverId, roleId, requesterId);
        ServerMember membership = requireManageableMember(serverId, userId, requesterId);

        if (!memberRoleRepository.existsByServerMemberIdAndRoleId(membership.getId(), role.getId())) {
            return;
        }
        memberRoleRepository.deleteById(new MemberRole.Key(membership.getId(), role.getId()));
        notify(serverId, Set.of(userId));
    }

    // ------------------------------------------------------------------ guards

    private void requireManageRoles(UUID serverId, UUID requesterId) {
        if (!permissionService.hasServer(serverId, requesterId, Permission.MANAGE_ROLES)) {
            throw new ForbiddenException("Você não tem permissão para gerenciar cargos");
        }
    }

    /** A role may only be touched from strictly above it. */
    private void requireCanManage(Role role, UUID requesterId) {
        if (permissionService.highestPosition(role.getServerId(), requesterId) <= role.getPosition()) {
            throw new ForbiddenException(
                    "Você não pode gerenciar um cargo no seu nível ou acima dele: " + role.getName());
        }
    }

    /**
     * A new or moved role must land strictly below the actor. Note the consequence for an actor
     * ranked 0 (MANAGE_ROLES granted through @everyone): no position qualifies, so it cannot create
     * anything. That is intended — MANAGE_ROLES belongs on a role above @everyone.
     */
    private void requireBelowActor(UUID serverId, UUID requesterId, int position) {
        if (position < 0) {
            throw new BadRequestException("A posição de um cargo não pode ser negativa");
        }
        if (position >= permissionService.highestPosition(serverId, requesterId)) {
            throw new ForbiddenException("Você não pode posicionar um cargo no seu nível ou acima dele");
        }
    }

    /** Without this, MANAGE_ROLES would be a path to every other permission. */
    private void requireActorHolds(UUID serverId, UUID requesterId, long permissions) {
        long actorPermissions = permissionService.serverPermissions(serverId, requesterId);
        long missing = permissions & ~actorPermissions;
        if (missing != 0) {
            throw new ForbiddenException(
                    "Você não pode conceder permissões que não possui: " + PermissionSet.toNames(missing));
        }
    }

    private Role requireAssignableRole(UUID serverId, UUID roleId, UUID requesterId) {
        Role role = requireRole(roleId);
        requireSameServer(role, serverId);
        if (role.isEveryone()) {
            throw new BadRequestException("O cargo @everyone já se aplica a todos os membros");
        }
        requireManageRoles(serverId, requesterId);
        requireCanManage(role, requesterId);
        return role;
    }

    private ServerMember requireManageableMember(UUID serverId, UUID userId, UUID requesterId) {
        // Compared through highestPosition rather than PermissionService.outranks so that role-vs-role
        // and actor-vs-member checks in this class read off the exact same notion of rank.
        if (permissionService.highestPosition(serverId, requesterId)
                <= permissionService.highestPosition(serverId, userId)) {
            throw new ForbiddenException("Você não pode alterar os cargos de alguém no seu nível ou acima");
        }
        return requireMembership(serverId, userId);
    }

    private ServerMember requireMembership(UUID serverId, UUID userId) {
        return serverMemberRepository.findByServerIdAndUserId(serverId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Not a member of this server: " + userId));
    }

    private Role requireRole(UUID roleId) {
        return roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: " + roleId));
    }

    private void requireSameServer(Role role, UUID serverId) {
        if (!role.getServerId().equals(serverId)) {
            // Not a 403: from this server's point of view the role simply does not exist.
            throw new ResourceNotFoundException("Role not found: " + role.getId());
        }
    }

    private static String requireValidName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("O nome do cargo é obrigatório");
        }
        if (trimmed.equalsIgnoreCase(EVERYONE_NAME)) {
            throw new BadRequestException("@everyone é um nome reservado");
        }
        return trimmed;
    }

    private static String requireValidColor(String color) {
        if (color == null || color.isBlank()) {
            return null;
        }
        if (!HEX_COLOR.matcher(color.trim()).matches()) {
            throw new BadRequestException("A cor deve estar no formato #RRGGBB");
        }
        return color.trim().toUpperCase();
    }

    // ------------------------------------------------------------------ realtime

    /** Editing @everyone reaches every member; any other role reaches only the people holding it. */
    private Set<UUID> affectedBy(Role role) {
        return role.isEveryone()
                ? serverMemberIds(role.getServerId())
                : new HashSet<>(memberRoleRepository.findUserIdsByRoleId(role.getId()));
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
