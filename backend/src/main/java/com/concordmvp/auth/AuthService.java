package com.concordmvp.auth;

import com.concordmvp.auth.dto.AuthResponse;
import com.concordmvp.auth.dto.LoginRequest;
import com.concordmvp.auth.dto.RegisterRequest;
import com.concordmvp.auth.verification.EmailVerificationService;
import com.concordmvp.common.RateLimiter;
import com.concordmvp.common.exception.ConflictException;
import com.concordmvp.common.exception.TooManyRequestsException;
import com.concordmvp.common.exception.UnauthorizedException;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
public class AuthService {

    private static final String INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha inválidos";
    /**
     * A well-formed but unusable bcrypt hash, compared against when the email doesn't exist so
     * that path costs the same bcrypt work as a wrong-password rejection — otherwise the faster
     * response for an unknown email is a timing side-channel an attacker can use to enumerate
     * registered addresses.
     */
    private static final String DUMMY_PASSWORD_HASH =
            "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;
    // In memory rather than Redis, per docs/DECISIONS.md D3. Keyed by normalized email, same
    // pattern as PasswordResetService/EmailVerificationService — every attempt counts, not just
    // failed ones, so it also caps how fast a valid password can be brute-forced.
    private final RateLimiter loginRateLimiter =
            new RateLimiter(5, Duration.ofMinutes(1), 20, Duration.ofHours(1));
    // A1 (security audit): the email-keyed limiter alone doesn't stop credential stuffing that
    // sweeps many different email addresses from one attacker — this bounds that by IP instead.
    // Same thresholds as /register's IP limiter (ClientIp, D21).
    private final RateLimiter loginIpRateLimiter =
            new RateLimiter(10, Duration.ofMinutes(1), 30, Duration.ofHours(1));
    // Registration keeps the "este e-mail já está cadastrado" message — removing that signal
    // would mean no longer auto-logging the caller in on register, an architecture change (see
    // docs/DECISIONS.md D21). These two limiters make mass email-enumeration against /register
    // infeasible instead: one per candidate email (stops probing a single address) and one per
    // IP (stops scanning many candidates from one attacker).
    private final RateLimiter registerEmailRateLimiter =
            new RateLimiter(3, Duration.ofMinutes(1), 10, Duration.ofHours(1));
    private final RateLimiter registerIpRateLimiter =
            new RateLimiter(10, Duration.ofMinutes(1), 30, Duration.ofHours(1));

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            EmailVerificationService emailVerificationService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailVerificationService = emailVerificationService;
    }

    public AuthResponse register(RegisterRequest request, String clientIp) {
        String normalizedEmail = request.email() == null ? "" : request.email().trim().toLowerCase();
        Instant now = Instant.now();
        // Checked before touching the repository, same as loginRateLimiter — every attempt
        // counts, not just ones that turn out to hit an existing email.
        if (!registerEmailRateLimiter.tryAcquire(normalizedEmail, now)
                || !registerIpRateLimiter.tryAcquire(clientIp == null ? "" : clientIp, now)) {
            throw new TooManyRequestsException("Muitas tentativas. Tente novamente mais tarde.");
        }

        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Este e-mail já está cadastrado");
        }
        if (userRepository.existsByUsername(request.username())) {
            throw new ConflictException("Este nome de usuário já está em uso");
        }

        User user = new User();
        user.setUsername(request.username());
        user.setDisplayName(request.displayName());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));

        User saved = userRepository.save(user);
        emailVerificationService.sendVerification(saved);

        return new AuthResponse(
                saved.getId(), saved.getUsername(), saved.getDisplayName(), saved.getEmail(), saved.isEmailVerified());
    }

    public AuthResponse login(LoginRequest request, String clientIp) {
        String normalizedEmail = request.email() == null ? "" : request.email().trim().toLowerCase();
        Instant now = Instant.now();
        if (!loginRateLimiter.tryAcquire(normalizedEmail, now)
                || !loginIpRateLimiter.tryAcquire(clientIp == null ? "" : clientIp, now)) {
            // Same generic message as a wrong password/email below — a rate-limited response
            // must not be distinguishable from an ordinary failed login attempt.
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }

        Optional<User> maybeUser = userRepository.findByEmail(request.email());
        String hashToCompare = maybeUser.map(User::getPasswordHash).orElse(DUMMY_PASSWORD_HASH);
        boolean matches = passwordEncoder.matches(request.password(), hashToCompare);

        if (maybeUser.isEmpty() || !matches) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
        }
        User user = maybeUser.get();

        return new AuthResponse(
                user.getId(), user.getUsername(), user.getDisplayName(), user.getEmail(), user.isEmailVerified());
    }
}
