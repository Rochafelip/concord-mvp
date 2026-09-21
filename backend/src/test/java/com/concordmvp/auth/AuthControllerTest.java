package com.concordmvp.auth;

import com.concordmvp.auth.dto.AuthResponse;
import com.concordmvp.auth.dto.LoginRequest;
import com.concordmvp.auth.dto.RegisterRequest;
import com.concordmvp.auth.verification.EmailVerificationService;
import com.concordmvp.auth.reset.PasswordResetService;
import com.concordmvp.common.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @Mock
    private JwtService jwtService;

    @Mock
    private EmailVerificationService emailVerificationService;
    @Mock
    private PasswordResetService passwordResetService;

    @Mock
    private JwtDenylist jwtDenylist;

    private AuthController authController;

    @BeforeEach
    void setUp() {
        authController = new AuthController(
                authService,
                jwtService,
                new SessionCookieFactory(jwtService),
                emailVerificationService,
                passwordResetService,
                jwtDenylist
        );
    }

    @Test
    void register_setsHttpOnlySessionCookie_andOmitsTokenFromBody() {
        UUID userId = UUID.randomUUID();
        AuthResponse response = new AuthResponse(userId, "alice", "Alice", "alice@example.com", false);
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");
        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        httpRequest.addHeader("X-Real-IP", "203.0.113.1");

        when(authService.register(request, "203.0.113.1")).thenReturn(response);
        when(jwtService.generateToken(userId)).thenReturn("signed-token");
        when(jwtService.tokenTtl()).thenReturn(Duration.ofDays(30));

        ResponseEntity<AuthResponse> result = authController.register(request, httpRequest);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(result.getBody()).isEqualTo(response);

        String cookie = result.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("concord_session=signed-token");
        assertThat(cookie).contains("HttpOnly");
        assertThat(cookie).contains("Secure");
        assertThat(cookie).contains("SameSite=Strict");
        assertThat(cookie).contains("Max-Age=2592000");
    }

    @Test
    void login_setsHttpOnlySessionCookie_andOmitsTokenFromBody() {
        UUID userId = UUID.randomUUID();
        AuthResponse response = new AuthResponse(userId, "alice", "Alice", "alice@example.com", false);
        LoginRequest request = new LoginRequest("alice@example.com", "password123");

        when(authService.login(request)).thenReturn(response);
        when(jwtService.generateToken(userId)).thenReturn("signed-token");
        when(jwtService.tokenTtl()).thenReturn(Duration.ofDays(30));

        ResponseEntity<AuthResponse> result = authController.login(request);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(result.getBody()).isEqualTo(response);

        String cookie = result.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("concord_session=signed-token");
        assertThat(cookie).contains("HttpOnly");
    }

    @Test
    void logout_withNoCookie_clearsSessionCookie_andDoesNotTouchTheDenylist() {
        ResponseEntity<Void> result = authController.logout(null);

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        String cookie = result.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("concord_session=");
        assertThat(cookie).contains("Max-Age=0");
        verifyNoInteractions(jwtDenylist);
    }

    @Test
    void logout_withAValidCookie_revokesItsJti_andClearsTheCookie() {
        UUID jti = UUID.randomUUID();
        Instant expiresAt = Instant.now().plus(Duration.ofDays(10));
        when(jwtService.parseJti("current-token")).thenReturn(jti);
        when(jwtService.parseExpiration("current-token")).thenReturn(expiresAt);

        ResponseEntity<Void> result = authController.logout("current-token");

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(jwtDenylist).revoke(jti, expiresAt);
        String cookie = result.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("Max-Age=0");
    }

    @Test
    void logout_withAnAlreadyInvalidCookie_stillClearsTheCookie_withoutBlowingUp() {
        when(jwtService.parseJti("garbage"))
                .thenThrow(new UnauthorizedException("Sessão inválida ou expirada"));

        ResponseEntity<Void> result = authController.logout("garbage");

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(jwtDenylist, never()).revoke(any(), any());
    }
}
