package com.concordmvp.auth;

import com.concordmvp.auth.dto.AuthResponse;
import com.concordmvp.auth.dto.LoginRequest;
import com.concordmvp.auth.dto.RegisterRequest;
import com.concordmvp.auth.verification.EmailVerificationService;
import com.concordmvp.common.exception.ConflictException;
import com.concordmvp.common.exception.TooManyRequestsException;
import com.concordmvp.common.exception.UnauthorizedException;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EmailVerificationService emailVerificationService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, emailVerificationService);
    }

    @Test
    void register_hashesPasswordAndReturnsUserProfile() {
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        UUID generatedId = UUID.randomUUID();

        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(generatedId);
            return user;
        });

        AuthResponse response = authService.register(request, "203.0.113.1");

        ArgumentCaptor<User> savedUserCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedUserCaptor.capture());
        User savedUser = savedUserCaptor.getValue();

        assertThat(savedUser.getUsername()).isEqualTo("alice");
        assertThat(savedUser.getDisplayName()).isEqualTo("Alice");
        assertThat(savedUser.getEmail()).isEqualTo("alice@example.com");
        assertThat(savedUser.getPasswordHash()).isEqualTo("hashed-password");

        assertThat(response.userId()).isEqualTo(generatedId);
        assertThat(response.username()).isEqualTo("alice");
        assertThat(response.displayName()).isEqualTo("Alice");
        assertThat(response.email()).isEqualTo("alice@example.com");
        assertThat(response.emailVerified()).isFalse();
        verify(emailVerificationService).sendVerification(savedUserCaptor.getValue());
    }

    @Test
    void register_throwsConflict_whenEmailAlreadyRegistered() {
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request, "203.0.113.1"))
                .isInstanceOf(ConflictException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    void register_throwsConflict_whenUsernameAlreadyTaken() {
        // username is used as a public identity (friend requests, DMs, member lists), so it needs
        // the same uniqueness guarantee as email.
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("alice")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request, "203.0.113.1"))
                .isInstanceOf(ConflictException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    void register_tooManyAttemptsForTheSameEmail_throwsTooManyRequests() {
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> authService.register(request, "203.0.113.1"))
                    .isInstanceOf(ConflictException.class);
        }

        // Blocked before the repository is even consulted again — an attacker probing whether
        // "alice@example.com" is taken can't retry past this, whatever the real outcome would be.
        assertThatThrownBy(() -> authService.register(request, "203.0.113.1"))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void register_tooManyAttemptsFromTheSameIpAcrossDifferentEmails_throwsTooManyRequests() {
        // Each email is distinct, so the per-email limiter never fires — only the per-IP one
        // catches this, which is exactly the scan-many-candidates enumeration pattern it exists for.
        when(userRepository.existsByEmail(anyString())).thenReturn(true);

        for (int i = 0; i < 10; i++) {
            RegisterRequest request =
                    new RegisterRequest("user" + i, "User " + i, "user" + i + "@example.com", "password123");
            assertThatThrownBy(() -> authService.register(request, "203.0.113.1"))
                    .isInstanceOf(ConflictException.class);
        }

        RegisterRequest request = new RegisterRequest("user10", "User 10", "user10@example.com", "password123");
        assertThatThrownBy(() -> authService.register(request, "203.0.113.1"))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    void register_succeeds_forADifferentEmailAndIp_afterAnotherKeyIsRateLimited() {
        RegisterRequest floodedRequest = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);
        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> authService.register(floodedRequest, "203.0.113.1"))
                    .isInstanceOf(ConflictException.class);
        }
        assertThatThrownBy(() -> authService.register(floodedRequest, "203.0.113.1"))
                .isInstanceOf(TooManyRequestsException.class);

        RegisterRequest bobRequest = new RegisterRequest("bob", "Bob", "bob@example.com", "password123");
        UUID generatedId = UUID.randomUUID();
        when(userRepository.existsByEmail("bob@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("bob")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(generatedId);
            return user;
        });

        AuthResponse response = authService.register(bobRequest, "198.51.100.7");

        assertThat(response.userId()).isEqualTo(generatedId);
    }

    @Test
    void login_throwsUnauthorized_whenPasswordDoesNotMatch() {
        LoginRequest request = new LoginRequest("alice@example.com", "wrong-password");
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("alice@example.com");
        user.setPasswordHash("hashed-password");

        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request, "203.0.113.1"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage(unknownEmailExceptionMessage());
    }

    @Test
    void login_throwsUnauthorized_whenEmailIsUnknown() {
        LoginRequest request = new LoginRequest("unknown@example.com", "password123");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request, "203.0.113.1"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage(unknownEmailExceptionMessage());
    }

    @Test
    void login_unknownEmail_stillRunsAPasswordComparison_toAvoidATimingSideChannel() {
        // Otherwise an unknown-email response returns faster than a wrong-password one (no bcrypt
        // work done), letting an attacker enumerate registered emails by timing alone.
        LoginRequest request = new LoginRequest("unknown@example.com", "password123");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request, "203.0.113.1")).isInstanceOf(UnauthorizedException.class);

        verify(passwordEncoder).matches(eq("password123"), anyString());
    }

    @Test
    void login_wrongPasswordAndUnknownEmail_produceTheSameExceptionMessage() {
        // Ensures the login endpoint never leaks whether an email is registered.
        LoginRequest wrongPasswordRequest = new LoginRequest("alice@example.com", "wrong-password");
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("alice@example.com");
        user.setPasswordHash("hashed-password");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), eq("hashed-password"))).thenReturn(false);

        LoginRequest unknownEmailRequest = new LoginRequest("unknown@example.com", "password123");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        String messageForWrongPassword = catchExceptionMessage(() -> authService.login(wrongPasswordRequest, "203.0.113.1"));
        String messageForUnknownEmail = catchExceptionMessage(() -> authService.login(unknownEmailRequest, "203.0.113.1"));

        assertThat(messageForWrongPassword).isEqualTo(messageForUnknownEmail);
    }

    @Test
    void login_tooManyAttemptsInAShortWindow_throwsUnauthorized_withTheSameGenericMessage() {
        // Same message as wrong credentials, so a rate-limited response can't be told apart from
        // an ordinary failed login.
        LoginRequest request = new LoginRequest("alice@example.com", "wrong-password");
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("alice@example.com");
        user.setPasswordHash("hashed-password");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> authService.login(request, "203.0.113.1")).isInstanceOf(UnauthorizedException.class);
        }

        assertThatThrownBy(() -> authService.login(request, "203.0.113.1"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage(unknownEmailExceptionMessage());
        // Rate-limited, not a real credential check this time.
        verify(userRepository, times(5)).findByEmail("alice@example.com");
    }

    @Test
    void login_rateLimitIsPerEmail_anotherEmailIsUnaffected() {
        LoginRequest floodedRequest = new LoginRequest("alice@example.com", "wrong-password");
        User alice = new User();
        alice.setId(UUID.randomUUID());
        alice.setEmail("alice@example.com");
        alice.setPasswordHash("hashed-password");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(alice));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);
        for (int i = 0; i < 6; i++) {
            assertThatThrownBy(() -> authService.login(floodedRequest, "203.0.113.1")).isInstanceOf(UnauthorizedException.class);
        }

        LoginRequest bobRequest = new LoginRequest("bob@example.com", "password123");
        User bob = new User();
        bob.setId(UUID.randomUUID());
        bob.setEmail("bob@example.com");
        bob.setPasswordHash("hashed-password");
        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(bob));
        when(passwordEncoder.matches("password123", "hashed-password")).thenReturn(true);

        AuthResponse response = authService.login(bobRequest, "203.0.113.1");

        assertThat(response.userId()).isEqualTo(bob.getId());
    }

    @Test
    void login_tooManyAttemptsFromTheSameIpAcrossDifferentEmails_throwsUnauthorized() {
        // Each email is distinct, so the per-email limiter never fires — only the per-IP one
        // catches this, which is exactly the credential-stuffing-sweep pattern it exists for.
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        for (int i = 0; i < 10; i++) {
            LoginRequest request = new LoginRequest("user" + i + "@example.com", "password123");
            assertThatThrownBy(() -> authService.login(request, "203.0.113.1"))
                    .isInstanceOf(UnauthorizedException.class);
        }

        LoginRequest request = new LoginRequest("user10@example.com", "password123");
        assertThatThrownBy(() -> authService.login(request, "203.0.113.1"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage(unknownEmailExceptionMessage());
        // Rate-limited, not a real credential check this time.
        verify(userRepository, never()).findByEmail("user10@example.com");
    }

    @Test
    void login_rateLimitIsPerIp_anotherIpIsUnaffected() {
        LoginRequest request = new LoginRequest("unknown@example.com", "password123");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> authService.login(request, "203.0.113.1"))
                    .isInstanceOf(UnauthorizedException.class);
        }
        assertThatThrownBy(() -> authService.login(request, "203.0.113.1"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage(unknownEmailExceptionMessage());

        User bob = new User();
        bob.setId(UUID.randomUUID());
        bob.setEmail("bob@example.com");
        bob.setPasswordHash("hashed-password");
        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(bob));
        when(passwordEncoder.matches("password123", "hashed-password")).thenReturn(true);
        LoginRequest bobRequest = new LoginRequest("bob@example.com", "password123");

        AuthResponse response = authService.login(bobRequest, "198.51.100.7");

        assertThat(response.userId()).isEqualTo(bob.getId());
    }

    private String unknownEmailExceptionMessage() {
        return "E-mail ou senha inválidos";
    }

    private String catchExceptionMessage(Runnable runnable) {
        try {
            runnable.run();
            throw new AssertionError("Expected UnauthorizedException to be thrown");
        } catch (UnauthorizedException e) {
            return e.getMessage();
        }
    }
}
