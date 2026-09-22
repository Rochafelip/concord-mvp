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
    // requestReset() invalidates every earlier unused token for the user (see markAllUsedForUser
    // below), so a token can be "used" without anyone having ever clicked it: the person simply
    // asked for another link first. That is a different situation from actually having completed
    // a reset with this exact link, and from the link being older than TOKEN_TTL -- each gets its
    // own message so "solicite um novo link" doesn't get shown to someone whose newer email would
    // have worked.
    private static final String SUPERSEDED_TOKEN_MESSAGE =
            "Este link foi substituído por um pedido de redefinição mais recente. "
                    + "Use o e-mail mais novo que você recebeu ou solicite outro link";
    private static final String ALREADY_USED_TOKEN_MESSAGE =
            "Este link já foi usado para redefinir a senha. "
                    + "Solicite um novo link se ainda precisar trocar a senha";

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

        PasswordResetToken token = tokenRepository.findByTokenHash(TokenHashing.hash(rawToken))
                .orElseThrow(() -> new BadRequestException(INVALID_TOKEN_MESSAGE));

        if (token.isUsable(now)) {
            return token;
        }

        if (token.getUsedAt() != null) {
            boolean superseded = tokenRepository.existsByUserIdAndCreatedAtAfter(
                    token.getUserId(), token.getCreatedAt());
            throw new BadRequestException(superseded ? SUPERSEDED_TOKEN_MESSAGE : ALREADY_USED_TOKEN_MESSAGE);
        }

        throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }
}
