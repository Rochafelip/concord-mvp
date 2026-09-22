package com.concordmvp.users;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ConflictException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.common.exception.TooManyRequestsException;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.servers.ServerMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AvatarStorageService avatarStorageService;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    private UserService userService;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, passwordEncoder,
                avatarStorageService, serverMemberRepository, realtimeEventPublisher);
    }

    @Test
    void getCurrentUser_returnsUser_whenFound() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        User result = userService.getCurrentUser(userId);

        assertThat(result).isSameAs(user);
    }

    @Test
    void getCurrentUser_throwsResourceNotFound_whenMissing() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getCurrentUser(userId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updateProfile_updatesUsernameAndDisplayName() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");
        user.setDisplayName("Alice");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        User result = userService.updateProfile(userId, "alice2", "Alice Two");

        assertThat(result.getUsername()).isEqualTo("alice2");
        assertThat(result.getDisplayName()).isEqualTo("Alice Two");
    }

    @Test
    void updateProfile_throwsConflict_whenUsernameTakenByAnotherUser() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");
        user.setDisplayName("Alice");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.existsByUsernameAndIdNot("bob", userId)).thenReturn(true);

        assertThatThrownBy(() -> userService.updateProfile(userId, "bob", "Alice Two"))
                .isInstanceOf(ConflictException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    void changePassword_updatesPasswordHash_whenCurrentPasswordMatches() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setPasswordHash("old-hash");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("current-pw", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("new-pw")).thenReturn("new-hash");
        when(userRepository.save(user)).thenReturn(user);

        User result = userService.changePassword(userId, "current-pw", "new-pw");

        assertThat(result.getPasswordHash()).isEqualTo("new-hash");
    }

    @Test
    void changePassword_throwsBadRequest_whenCurrentPasswordDoesNotMatch() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setPasswordHash("old-hash");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-pw", "old-hash")).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(userId, "wrong-pw", "new-pw"))
                .isInstanceOf(BadRequestException.class);

        verify(userRepository, never()).save(any());
    }

    private MockMultipartFile avatarFile() {
        return new MockMultipartFile("file", "a.png", "image/png", new byte[] {1, 2, 3});
    }

    private void stubSuccessfulAvatarUpload(UUID userId, User user) {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(avatarStorageService.store(eq(userId), any())).thenReturn(
                new AvatarStorageService.StoredAvatar("avatars/" + userId + "/a.png", "image/png"));
        when(userRepository.save(user)).thenReturn(user);
    }

    @Test
    void updateAvatar_tooManyUploadsInAShortWindow_throwsTooManyRequests() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        stubSuccessfulAvatarUpload(userId, user);

        for (int i = 0; i < 3; i++) {
            userService.updateAvatar(userId, avatarFile());
        }

        assertThatThrownBy(() -> userService.updateAvatar(userId, avatarFile()))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void updateAvatar_rateLimitIsPerUser_anotherUserIsUnaffected() {
        UUID floodedUserId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        User floodedUser = new User();
        floodedUser.setId(floodedUserId);
        User otherUser = new User();
        otherUser.setId(otherUserId);
        stubSuccessfulAvatarUpload(floodedUserId, floodedUser);
        stubSuccessfulAvatarUpload(otherUserId, otherUser);

        for (int i = 0; i < 3; i++) {
            userService.updateAvatar(floodedUserId, avatarFile());
        }
        assertThatThrownBy(() -> userService.updateAvatar(floodedUserId, avatarFile()))
                .isInstanceOf(TooManyRequestsException.class);

        User result = userService.updateAvatar(otherUserId, avatarFile());

        assertThat(result.getId()).isEqualTo(otherUserId);
    }
}
