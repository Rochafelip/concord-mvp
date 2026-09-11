package com.concordmvp.auth;

import com.concordmvp.auth.dto.AuthResponse;
import com.concordmvp.auth.dto.LoginRequest;
import com.concordmvp.auth.dto.RegisterRequest;
import com.concordmvp.auth.dto.VerifyEmailRequest;
import com.concordmvp.auth.verification.EmailVerificationService;
import com.concordmvp.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final EmailVerificationService emailVerificationService;

    public AuthController(
            AuthService authService,
            JwtService jwtService,
            EmailVerificationService emailVerificationService
    ) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        String token = jwtService.generateToken(response.userId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, sessionCookie(token).toString())
                .body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        String token = jwtService.generateToken(response.userId());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie(token).toString())
                .body(response);
    }

    /**
     * JS can't clear an httpOnly cookie itself, so logout has to be a real request. No auth
     * required to call this — clearing an already-invalid or already-absent cookie is harmless.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clearedSessionCookie().toString())
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

    private ResponseCookie sessionCookie(String token) {
        return ResponseCookie.from(JwtService.COOKIE_NAME, token)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(jwtService.tokenTtl())
                .build();
    }

    private ResponseCookie clearedSessionCookie() {
        return ResponseCookie.from(JwtService.COOKIE_NAME, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
    }
}
