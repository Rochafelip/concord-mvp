package com.concordmvp.auth;

import com.concordmvp.auth.dto.AuthResponse;
import com.concordmvp.auth.dto.LoginRequest;
import com.concordmvp.auth.dto.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @Mock
    private JwtService jwtService;

    private AuthController authController;

    @BeforeEach
    void setUp() {
        authController = new AuthController(authService, jwtService);
    }

    @Test
    void register_setsHttpOnlySessionCookie_andOmitsTokenFromBody() {
        UUID userId = UUID.randomUUID();
        AuthResponse response = new AuthResponse(userId, "alice", "Alice", "alice@example.com");
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "password123");

        when(authService.register(request)).thenReturn(response);
        when(jwtService.generateToken(userId)).thenReturn("signed-token");
        when(jwtService.tokenTtl()).thenReturn(Duration.ofDays(30));

        ResponseEntity<AuthResponse> result = authController.register(request);

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
        AuthResponse response = new AuthResponse(userId, "alice", "Alice", "alice@example.com");
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
    void logout_clearsSessionCookie() {
        ResponseEntity<Void> result = authController.logout();

        assertThat(result.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        String cookie = result.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("concord_session=");
        assertThat(cookie).contains("Max-Age=0");
    }
}
