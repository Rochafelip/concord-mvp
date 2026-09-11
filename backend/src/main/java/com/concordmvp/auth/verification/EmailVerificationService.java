package com.concordmvp.auth.verification;

import com.concordmvp.common.RateLimiter;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.mail.MailService;
import com.concordmvp.common.token.TokenHashing;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Issues and consumes the links that confirm a user's email address.
 *
 * An unverified account still works (see the spec): the banner nags, but nobody is locked out by
 * an email that landed in spam.
 */
@Service
public class EmailVerificationService {

    private static final Duration TOKEN_TTL = Duration.ofHours(24);

    /**
     * One message for expired, already-used and never-issued alike. Telling them apart would only
     * help someone probing tokens.
     */
    private static final String INVALID_TOKEN_MESSAGE = "Link de confirmação inválido ou expirado";

    private final EmailVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final MailService mailService;
    private final String baseUrl;
    private final RateLimiter rateLimiter = new RateLimiter(1, Duration.ofMinutes(1), 5, Duration.ofHours(1));

    public EmailVerificationService(
            EmailVerificationTokenRepository tokenRepository,
            UserRepository userRepository,
            MailService mailService,
            @Value("${app.base-url}") String baseUrl
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.mailService = mailService;
        this.baseUrl = baseUrl;
    }

    @Transactional
    public void sendVerification(User user) {
        Instant now = Instant.now();
        tokenRepository.markAllUsedForUser(user.getId(), now);

        String rawToken = TokenHashing.generateToken();
        EmailVerificationToken token = new EmailVerificationToken();
        token.setUserId(user.getId());
        token.setTokenHash(TokenHashing.hash(rawToken));
        token.setExpiresAt(now.plus(TOKEN_TTL));
        tokenRepository.save(token);

        mailService.sendVerificationEmail(
                user.getEmail(), user.getDisplayName(), baseUrl + "/verify-email?token=" + rawToken);
    }

    /**
     * Returns silently when there is nothing to do -- already verified, or rate limited. The
     * caller answers 204 either way, so the client learns nothing it could abuse.
     */
    @Transactional
    public void resend(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BadRequestException(INVALID_TOKEN_MESSAGE));

        if (user.isEmailVerified() || !rateLimiter.tryAcquire(user.getId().toString(), Instant.now())) {
            return;
        }

        sendVerification(user);
    }

    @Transactional
    public void verify(String rawToken) {
        Instant now = Instant.now();

        EmailVerificationToken token = tokenRepository.findByTokenHash(TokenHashing.hash(rawToken))
                .filter(candidate -> candidate.isUsable(now))
                .orElseThrow(() -> new BadRequestException(INVALID_TOKEN_MESSAGE));

        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new BadRequestException(INVALID_TOKEN_MESSAGE));

        user.setEmailVerified(true);
        userRepository.save(user);

        token.setUsedAt(now);
        tokenRepository.save(token);
    }
}
