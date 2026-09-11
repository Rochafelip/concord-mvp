package com.concordmvp.auth.reset;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.mail.MailService;
import com.concordmvp.common.token.TokenHashing;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceTest {

    @Mock
    private PasswordResetTokenRepository tokenRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private MailService mailService;

    private PasswordResetService service;
    private User user;
    private PasswordResetToken storedToken;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(
                tokenRepository, userRepository, passwordEncoder, mailService, "https://app.test");
        user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPassword1")).thenReturn("encoded-NewPassword1");

        storedToken = new PasswordResetToken();
        storedToken.setUserId(user.getId());
        storedToken.setTokenHash(TokenHashing.hash("raw-token"));
        storedToken.setExpiresAt(Instant.now().plusSeconds(3600));
        when(tokenRepository.findByTokenHash(TokenHashing.hash("raw-token")))
                .thenReturn(Optional.of(storedToken));
    }

    @Test
    void sendsAResetLinkForAKnownEmail() {
        service.requestReset("alice@example.com");

        verify(mailService).sendPasswordResetEmail(eq("alice@example.com"), eq("Alice"), anyString());
    }

    @Test
    void staysSilentForAnUnknownEmail() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatCode(() -> service.requestReset("ghost@example.com")).doesNotThrowAnyException();

        verify(mailService, never()).sendPasswordResetEmail(anyString(), anyString(), anyString());
    }

    @Test
    void resettingStoresTheNewHashAndStampsPasswordChangedAt() {
        service.reset("raw-token", "NewPassword1");

        assertThat(user.getPasswordHash()).isEqualTo("encoded-NewPassword1");
        assertThat(user.getPasswordChangedAt()).isNotNull();
    }

    @Test
    void resettingConsumesTheToken() {
        service.reset("raw-token", "NewPassword1");

        assertThat(storedToken.getUsedAt()).isNotNull();
        verify(tokenRepository).save(storedToken);
    }

    @Test
    void rejectsAnExpiredToken() {
        storedToken.setExpiresAt(Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.reset("raw-token", "NewPassword1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Link de redefinição inválido ou expirado");
    }

    @Test
    void verifyingDoesNotConsumeTheToken() {
        service.verifyToken("raw-token");

        assertThat(storedToken.getUsedAt()).isNull();
    }

    @Test
    void storesOnlyTheHashOfIssuedTokens() {
        service.requestReset("alice@example.com");

        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(captor.capture());
        assertThat(captor.getValue().getTokenHash()).hasSize(64);
    }
}
