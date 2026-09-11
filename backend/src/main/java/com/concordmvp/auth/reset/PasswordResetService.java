package com.concordmvp.auth.reset;

import com.concordmvp.common.RateLimiter;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.mail.MailService;
import com.concordmvp.common.token.TokenHashing;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class PasswordResetService {

    private static final Duration TOKEN_TTL = Duration.ofHours(1);
    private static final String INVALID_TOKEN_MESSAGE = "Link de redefinição inválido ou expirado";

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final String baseUrl;
    private final RateLimiter rateLimiter =
            new RateLimiter(1, Duration.ofMinutes(1), 5, Duration.ofHours(1));

    public PasswordResetService(
            PasswordResetTokenRepository tokenRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            MailService mailService,
            @Value("${app.base-url}") String baseUrl
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.baseUrl = baseUrl;
    }

    @Transactional
    public void requestReset(String email) {
        if (email == null) {
            return;
        }

        String normalized = email.trim().toLowerCase();
        if (!rateLimiter.tryAcquire(normalized, Instant.now())) {
            return;
        }

        userRepository.findByEmail(normalized).ifPresent(user -> {
            Instant now = Instant.now();
            tokenRepository.markAllUsedForUser(user.getId(), now);

            String rawToken = TokenHashing.generateToken();
            PasswordResetToken token = new PasswordResetToken();
            token.setUserId(user.getId());
            token.setTokenHash(TokenHashing.hash(rawToken));
            token.setExpiresAt(now.plus(TOKEN_TTL));
            tokenRepository.save(token);

            mailService.sendPasswordResetEmail(
                    user.getEmail(), user.getDisplayName(), baseUrl + "/reset-password?token=" + rawToken);
        });
    }

    @Transactional(readOnly = true)
    public void verifyToken(String rawToken) {
        findUsableToken(rawToken, Instant.now());
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        Instant now = Instant.now();
        PasswordResetToken token = findUsableToken(rawToken, now);
        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new BadRequestException(INVALID_TOKEN_MESSAGE));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(now);
        userRepository.save(user);

        token.setUsedAt(now);
        tokenRepository.save(token);
    }

    private PasswordResetToken findUsableToken(String rawToken, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        }

        return tokenRepository.findByTokenHash(TokenHashing.hash(rawToken))
                .filter(token -> token.isUsable(now))
                .orElseThrow(() -> new BadRequestException(INVALID_TOKEN_MESSAGE));
    }
}
