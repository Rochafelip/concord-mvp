package com.concordmvp.auth.verification;

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

import java.time.Instant;
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
@MockitoSettings(strictness = Strictness.LENIENT)
class EmailVerificationServiceTest {

    @Mock
    private EmailVerificationTokenRepository tokenRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private MailService mailService;

    private EmailVerificationService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new EmailVerificationService(tokenRepository, userRepository, mailService, "https://app.test");
        user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    }

    private String capturedRawToken() {
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendVerificationEmail(eq("alice@example.com"), eq("Alice"), link.capture());
        return link.getValue().substring(link.getValue().indexOf("token=") + "token=".length());
    }

    private EmailVerificationToken storeUsableTokenFor(String rawToken) {
        EmailVerificationToken token = new EmailVerificationToken();
        token.setUserId(user.getId());
        token.setTokenHash(TokenHashing.hash(rawToken));
        token.setExpiresAt(Instant.now().plusSeconds(3600));
        when(tokenRepository.findByTokenHash(TokenHashing.hash(rawToken))).thenReturn(Optional.of(token));
        return token;
    }

    @Test
    void issuingATokenRetiresTheOutstandingOnes() {
        service.sendVerification(user);

        verify(tokenRepository).markAllUsedForUser(eq(user.getId()), any(Instant.class));
    }

    @Test
    void storesOnlyTheHashNeverTheRawToken() {
        service.sendVerification(user);

        ArgumentCaptor<EmailVerificationToken> saved = ArgumentCaptor.forClass(EmailVerificationToken.class);
        verify(tokenRepository).save(saved.capture());
        String rawToken = capturedRawToken();

        assertThat(saved.getValue().getTokenHash()).isEqualTo(TokenHashing.hash(rawToken));
        assertThat(saved.getValue().getTokenHash()).isNotEqualTo(rawToken);
    }

    @Test
    void buildsTheLinkFromTheConfiguredBaseUrl() {
        service.sendVerification(user);

        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendVerificationEmail(anyString(), anyString(), link.capture());
        assertThat(link.getValue()).startsWith("https://app.test/verify-email?token=");
    }

    @Test
    void verifyingMarksTheUserAndConsumesTheToken() {
        EmailVerificationToken token = storeUsableTokenFor("raw-token");

        service.verify("raw-token");

        assertThat(user.isEmailVerified()).isTrue();
        assertThat(token.getUsedAt()).isNotNull();
        verify(userRepository).save(user);
    }

    @Test
    void rejectsAnExpiredToken() {
        EmailVerificationToken token = storeUsableTokenFor("raw-token");
        token.setExpiresAt(Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.verify("raw-token"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Link de confirmação inválido ou expirado");
    }

    @Test
    void rejectsAnAlreadyUsedToken() {
        EmailVerificationToken token = storeUsableTokenFor("raw-token");
        token.setUsedAt(Instant.now().minusSeconds(10));

        // Same message as expired and unknown, deliberately: telling the three apart would only
        // help someone probing tokens.
        assertThatThrownBy(() -> service.verify("raw-token"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Link de confirmação inválido ou expirado");
    }

    @Test
    void rejectsAnUnknownToken() {
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.verify("never-issued"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Link de confirmação inválido ou expirado");
    }

    @Test
    void resendSendsAgainForAnUnverifiedUser() {
        service.resend(user.getId());

        verify(mailService).sendVerificationEmail(eq("alice@example.com"), anyString(), anyString());
    }

    @Test
    void resendDoesNothingForAnAlreadyVerifiedUser() {
        user.setEmailVerified(true);

        service.resend(user.getId());

        verify(mailService, never()).sendVerificationEmail(anyString(), anyString(), anyString());
    }

    @Test
    void resendIsRateLimited() {
        service.resend(user.getId());
        service.resend(user.getId());

        // Second call inside the same minute must not reach the mail server.
        verify(mailService).sendVerificationEmail(anyString(), anyString(), anyString());
    }
}
