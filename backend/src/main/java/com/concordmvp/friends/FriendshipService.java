package com.concordmvp.friends;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ConflictException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.friends.dto.FriendRequestResponse;
import com.concordmvp.friends.dto.FriendResponse;
import com.concordmvp.friends.dto.FriendUpdatePayload;
import com.concordmvp.friends.dto.PendingFriendRequestsResponse;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WebSocketSessionRegistry;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.User;
import com.concordmvp.users.UserAvatarUrls;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.dto.UserSummaryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final UserRepository userRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final WebSocketSessionRegistry sessionRegistry;

    public FriendshipService(FriendshipRepository friendshipRepository,
                              ServerMemberRepository serverMemberRepository,
                              UserRepository userRepository,
                              RealtimeEventPublisher realtimeEventPublisher,
                              WebSocketSessionRegistry sessionRegistry) {
        this.friendshipRepository = friendshipRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.userRepository = userRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.sessionRegistry = sessionRegistry;
    }

    @Transactional
    public Friendship sendRequest(UUID requesterId, UUID addresseeId) {
        if (requesterId.equals(addresseeId)) {
            throw new BadRequestException("Você não pode adicionar a si mesmo como amigo");
        }
        userRepository.findById(addresseeId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + addresseeId));

        if (!shareAnyServer(requesterId, addresseeId)) {
            throw new ForbiddenException("Vocês precisam ter um servidor em comum para adicionar amizade");
        }

        friendshipRepository.findByPair(requesterId, addresseeId).ifPresent(existing -> {
            if (existing.getStatus() == FriendshipStatus.ACCEPTED) {
                throw new ConflictException("Vocês já são amigos");
            }
            throw new ConflictException("Já existe um pedido de amizade pendente entre vocês");
        });

        Friendship friendship = new Friendship();
        friendship.setRequesterId(requesterId);
        friendship.setAddresseeId(addresseeId);
        friendship.setStatus(FriendshipStatus.PENDING);
        Friendship saved = friendshipRepository.save(friendship);

        notify(requesterId, addresseeId);
        return saved;
    }

    @Transactional
    public Friendship acceptRequest(UUID friendshipId, UUID currentUserId) {
        Friendship friendship = requirePending(friendshipId);
        if (!friendship.getAddresseeId().equals(currentUserId)) {
            throw new ForbiddenException("Somente quem recebeu o pedido pode aceitá-lo");
        }

        // Conditional UPDATE instead of read-then-save: two requests racing past the PENDING
        // check above could otherwise both save ACCEPTED and both call notify() below, sending a
        // duplicate FRIEND_UPDATE. Only the request whose UPDATE actually flips a row gets to
        // notify.
        if (friendshipRepository.acceptIfPending(friendshipId) == 0) {
            throw new ResourceNotFoundException("Friendship not found: " + friendshipId);
        }
        friendship.setStatus(FriendshipStatus.ACCEPTED);

        notify(friendship.getRequesterId(), friendship.getAddresseeId());
        return friendship;
    }

    /** Cancels (by the requester) or declines (by the addressee) a still-pending request. */
    @Transactional
    public void cancelOrDecline(UUID friendshipId, UUID currentUserId) {
        Friendship friendship = requirePending(friendshipId);
        if (!friendship.involves(currentUserId)) {
            throw new ForbiddenException("Você não faz parte deste pedido de amizade");
        }

        friendshipRepository.delete(friendship);
        notify(friendship.getRequesterId(), friendship.getAddresseeId());
    }

    @Transactional
    public void removeFriend(UUID friendshipId, UUID currentUserId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Friendship not found: " + friendshipId));
        if (friendship.getStatus() != FriendshipStatus.ACCEPTED) {
            throw new ResourceNotFoundException("Friendship not found: " + friendshipId);
        }
        if (!friendship.involves(currentUserId)) {
            throw new ForbiddenException("Você não faz parte desta amizade");
        }

        friendshipRepository.delete(friendship);
        notify(friendship.getRequesterId(), friendship.getAddresseeId());
    }

    public List<FriendResponse> listFriends(UUID userId) {
        List<Friendship> accepted = friendshipRepository.findAcceptedForUser(userId);
        Map<UUID, User> usersById = usersById(accepted.stream().map(f -> f.otherUserId(userId)).toList());
        return accepted.stream()
                .map(f -> {
                    UUID otherId = f.otherUserId(userId);
                    return new FriendResponse(
                            f.getId(), toSummary(requireUser(usersById, otherId)), isOnline(otherId), f.getUpdatedAt());
                })
                .toList();
    }

    public PendingFriendRequestsResponse listPending(UUID userId) {
        List<Friendship> incomingFriendships =
                friendshipRepository.findByStatusAndAddresseeId(FriendshipStatus.PENDING, userId);
        List<Friendship> outgoingFriendships =
                friendshipRepository.findByStatusAndRequesterId(FriendshipStatus.PENDING, userId);

        List<UUID> otherIds = new ArrayList<>(incomingFriendships.size() + outgoingFriendships.size());
        incomingFriendships.forEach(f -> otherIds.add(f.getRequesterId()));
        outgoingFriendships.forEach(f -> otherIds.add(f.getAddresseeId()));
        Map<UUID, User> usersById = usersById(otherIds);

        List<FriendRequestResponse> incoming = incomingFriendships.stream()
                .map(f -> toRequestResponse(f, requireUser(usersById, f.getRequesterId())))
                .toList();
        List<FriendRequestResponse> outgoing = outgoingFriendships.stream()
                .map(f -> toRequestResponse(f, requireUser(usersById, f.getAddresseeId())))
                .toList();
        return new PendingFriendRequestsResponse(incoming, outgoing);
    }

    // ------------------------------------------------------------------ internals

    private Friendship requirePending(UUID friendshipId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Friendship not found: " + friendshipId));
        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new ResourceNotFoundException("Friendship not found: " + friendshipId);
        }
        return friendship;
    }

    private boolean shareAnyServer(UUID userA, UUID userB) {
        Set<UUID> serversOfA = new HashSet<>();
        serverMemberRepository.findByUserIdOrderByJoinedAtAsc(userA)
                .forEach(m -> serversOfA.add(m.getServerId()));
        return serverMemberRepository.findByUserIdOrderByJoinedAtAsc(userB).stream()
                .map(ServerMember::getServerId)
                .anyMatch(serversOfA::contains);
    }

    private FriendRequestResponse toRequestResponse(Friendship friendship, User other) {
        return new FriendRequestResponse(friendship.getId(), toSummary(other), friendship.getCreatedAt());
    }

    /** Batches the per-friendship user lookups in {@code listFriends}/{@code listPending} into
     *  one {@code IN (...)} query instead of one {@code findById} per row. */
    private Map<UUID, User> usersById(List<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private User requireUser(Map<UUID, User> usersById, UUID id) {
        User user = usersById.get(id);
        if (user == null) {
            throw new ResourceNotFoundException("User not found: " + id);
        }
        return user;
    }

    private UserSummaryResponse toSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getUsername(), user.getDisplayName(),
                UserAvatarUrls.url(user));
    }

    private boolean isOnline(UUID userId) {
        return sessionRegistry.isOnline(userId);
    }

    private void notify(UUID userId, UUID otherUserId) {
        realtimeEventPublisher.broadcast(Set.of(userId, otherUserId),
                new WsEvent(WsEventType.FRIEND_UPDATE, new FriendUpdatePayload(userId, otherUserId)));
    }
}
