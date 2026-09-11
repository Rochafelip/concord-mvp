package com.concordmvp.users;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.dto.UserProfileUpdatePayload;
import com.concordmvp.users.dto.UserSummaryResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.UUID;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AvatarStorageService avatarStorageService;
    private final ServerMemberRepository serverMemberRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;

    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       AvatarStorageService avatarStorageService, ServerMemberRepository serverMemberRepository,
                       RealtimeEventPublisher realtimeEventPublisher) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.avatarStorageService = avatarStorageService;
        this.serverMemberRepository = serverMemberRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this(userRepository, passwordEncoder, null, null, null);
    }

    /**
     * Looks up the currently authenticated user by id. Not expected to fail in practice since
     * the id comes from a validated JWT issued for a real user, but we defend against it anyway
     * (e.g. the user was deleted after the token was issued).
     */
    public User getCurrentUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    public User getAvatarForRequester(UUID targetUserId, UUID requesterId) {
        User target = getCurrentUser(targetUserId);
        if (targetUserId.equals(requesterId)
                || serverMemberRepository.findByUserIdOrderByJoinedAtAsc(targetUserId).stream()
                .anyMatch(membership -> serverMemberRepository
                        .existsByServerIdAndUserId(membership.getServerId(), requesterId))) {
            return target;
        }
        throw new com.concordmvp.common.exception.ForbiddenException("You cannot view this avatar");
    }

    public User updateProfile(UUID userId, String username, String displayName) {
        User user = getCurrentUser(userId);
        user.setUsername(username);
        user.setDisplayName(displayName);
        User saved = userRepository.save(user);
        publishProfileUpdate(saved);
        return saved;
    }

    public User changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = getCurrentUser(userId);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadRequestException("Senha atual incorreta");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(Instant.now());
        return userRepository.save(user);
    }

    public User updateAvatar(UUID userId, org.springframework.web.multipart.MultipartFile file) {
        User user = getCurrentUser(userId);
        AvatarStorageService.StoredAvatar stored = avatarStorageService.store(userId, file);
        String previous = user.getAvatarStorageKey();
        user.setAvatarStorageKey(stored.storageKey());
        User saved;
        try {
            saved = userRepository.save(user);
        } catch (RuntimeException ex) {
            try {
                avatarStorageService.delete(stored.storageKey());
            } catch (java.io.IOException cleanupFailure) {
                ex.addSuppressed(cleanupFailure);
            }
            throw ex;
        }
        publishProfileUpdate(saved);
        if (previous != null) {
            try {
                avatarStorageService.delete(previous);
            } catch (java.io.IOException ex) {
                log.error("Failed to remove previous avatar file {}", previous, ex);
            }
        }
        return saved;
    }

    public void removeAvatar(UUID userId) {
        User user = getCurrentUser(userId);
        String previous = user.getAvatarStorageKey();
        if (previous == null) return;
        user.setAvatarStorageKey(null);
        User saved = userRepository.save(user);
        publishProfileUpdate(saved);
        try {
            avatarStorageService.delete(previous);
        } catch (java.io.IOException ex) {
            log.error("Failed to remove avatar file {}", previous, ex);
        }
    }

    private void publishProfileUpdate(User user) {
        if (realtimeEventPublisher == null) return;
        Set<UUID> recipients = new HashSet<>();
        recipients.add(user.getId());
        if (serverMemberRepository != null) {
            for (ServerMember membership : serverMemberRepository.findByUserIdOrderByJoinedAtAsc(user.getId())) {
                serverMemberRepository.findByServerId(membership.getServerId()).stream()
                        .map(ServerMember::getUserId).forEach(recipients::add);
            }
        }
        UserSummaryResponse summary = new UserSummaryResponse(user.getId(), user.getUsername(),
                user.getDisplayName(), UserAvatarUrls.url(user));
        realtimeEventPublisher.broadcast(recipients,
                new WsEvent(WsEventType.USER_PROFILE_UPDATE, new UserProfileUpdatePayload(summary)));
    }
}
