package com.concordmvp.auth;

import com.concordmvp.auth.dto.AuthResponse;
import com.concordmvp.auth.dto.LoginRequest;
import com.concordmvp.auth.dto.RegisterRequest;
import com.concordmvp.auth.dto.VerifyEmailRequest;
import com.concordmvp.auth.dto.ForgotPasswordRequest;
import com.concordmvp.auth.dto.ResetPasswordRequest;
import com.concordmvp.auth.dto.VerifyResetPasswordRequest;
import com.concordmvp.auth.reset.PasswordResetService;
import com.concordmvp.auth.verification.EmailVerificationService;
import com.concordmvp.common.ClientIp;
import com.concordmvp.common.CurrentUser;
import com.concordmvp.common.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final SessionCookieFactory sessionCookieFactory;
    private final EmailVerificationService emailVerificationService;
    private final PasswordResetService passwordResetService;
    private final JwtDenylist jwtDenylist;

    public AuthController(
            AuthService authService,
            JwtService jwtService,
            SessionCookieFactory sessionCookieFactory,
            EmailVerificationService emailVerificationService,
            PasswordResetService passwordResetService,
            JwtDenylist jwtDenylist
    ) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.sessionCookieFactory = sessionCookieFactory;
        this.emailVerificationService = emailVerificationService;
        this.passwordResetService = passwordResetService;
        this.jwtDenylist = jwtDenylist;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        AuthResponse response = authService.register(request, ClientIp.resolve(httpRequest));
        String token = jwtService.generateToken(response.userId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, sessionCookie(token).toString())
                .body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        AuthResponse response = authService.login(request, ClientIp.resolve(httpRequest));
        String token = jwtService.generateToken(response.userId());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie(token).toString())
                .body(response);
    }

    /**
     * JS can't clear an httpOnly cookie itself, so logout has to be a real request. No auth
     * required to call this — clearing an already-invalid or already-absent cookie is harmless.
     *
     * <p>Also revokes the current token's {@code jti} so it can't be replayed after logout (see
     * docs/DECISIONS.md D2) — best-effort: a missing, malformed or already-expired cookie simply
     * has nothing to revoke.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = JwtService.COOKIE_NAME, required = false) String token) {
        if (token != null) {
            try {
                UUID jti = jwtService.parseJti(token);
                Instant expiresAt = jwtService.parseExpiration(token);
                jwtDenylist.revoke(jti, expiresAt);
            } catch (UnauthorizedException e) {
                // Already invalid/expired/malformed — nothing to revoke.
            }
        }
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookieFactory.clear().toString())
                .build();
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        emailVerificationService.verify(request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/verify-email/resend")
    public ResponseEntity<Void> resendVerification() {
        emailVerificationService.resend(CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request.email());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password/verify")
    public ResponseEntity<Void> verifyResetPassword(@Valid @RequestBody VerifyResetPasswordRequest request) {
        passwordResetService.verifyToken(request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.reset(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }

    private org.springframework.http.ResponseCookie sessionCookie(String token) {
        return sessionCookieFactory.create(token);
    }
}
