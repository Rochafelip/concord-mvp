package com.concordmvp.auth;

import com.concordmvp.auth.dto.AuthResponse;
import com.concordmvp.auth.dto.LoginRequest;
import com.concordmvp.auth.dto.RegisterRequest;
import com.concordmvp.common.exception.ConflictException;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, jwtService);
    }

    @Test
    void register_hashesPasswordAndIssuesToken() {
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        UUID generatedId = UUID.randomUUID();

        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashed-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(generatedId);
            return user;
        });
        when(jwtService.generateToken(generatedId)).thenReturn("signed-token");

        AuthResponse response = authService.register(request);

        ArgumentCaptor<User> savedUserCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedUserCaptor.capture());
        User savedUser = savedUserCaptor.getValue();

        assertThat(savedUser.getUsername()).isEqualTo("alice");
        assertThat(savedUser.getDisplayName()).isEqualTo("Alice");
        assertThat(savedUser.getEmail()).isEqualTo("alice@example.com");
        assertThat(savedUser.getPasswordHash()).isEqualTo("hashed-password");

        assertThat(response.token()).isEqualTo("signed-token");
        assertThat(response.userId()).isEqualTo(generatedId);
        assertThat(response.username()).isEqualTo("alice");
        assertThat(response.displayName()).isEqualTo("Alice");
        assertThat(response.email()).isEqualTo("alice@example.com");
    }

    @Test
    void register_throwsConflict_whenEmailAlreadyRegistered() {
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class);

        verify(userRepository, never()).save(any());
        verify(jwtService, never()).generateToken(any());
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

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage(unknownEmailExceptionMessage());

        verify(jwtService, never()).generateToken(any());
    }

    @Test
    void login_throwsUnauthorized_whenEmailIsUnknown() {
        LoginRequest request = new LoginRequest("unknown@example.com", "password123");
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage(unknownEmailExceptionMessage());

        verify(jwtService, never()).generateToken(any());
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

        String messageForWrongPassword = catchExceptionMessage(() -> authService.login(wrongPasswordRequest));
        String messageForUnknownEmail = catchExceptionMessage(() -> authService.login(unknownEmailRequest));

        assertThat(messageForWrongPassword).isEqualTo(messageForUnknownEmail);
    }

    private String unknownEmailExceptionMessage() {
        return "Invalid email or password";
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
