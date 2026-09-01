package com.concordmvp.realtime;

import com.concordmvp.auth.JwtService;
import com.concordmvp.common.exception.UnauthorizedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtHandshakeInterceptorTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private WebSocketHandler webSocketHandler;

    private JwtHandshakeInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new JwtHandshakeInterceptor(jwtService);
    }

    @Test
    void beforeHandshake_validToken_proceedsAndStoresUserId() {
        UUID userId = UUID.randomUUID();
        when(jwtService.parseUserId("valid-token")).thenReturn(userId);

        ServerHttpRequest request = requestWithQuery("/ws?token=valid-token");
        ServerHttpResponse response = response();
        Map<String, Object> attributes = new HashMap<>();

        boolean result = interceptor.beforeHandshake(request, response, webSocketHandler, attributes);

        assertThat(result).isTrue();
        assertThat(attributes).containsEntry(JwtHandshakeInterceptor.USER_ID_ATTRIBUTE, userId);
    }

    @Test
    void beforeHandshake_missingToken_rejectsHandshake() {
        ServerHttpRequest request = requestWithQuery("/ws");
        ServletServerHttpResponse response = response();
        Map<String, Object> attributes = new HashMap<>();

        boolean result = interceptor.beforeHandshake(request, response, webSocketHandler, attributes);

        assertThat(result).isFalse();
        assertThat(attributes).isEmpty();
        assertThat(response.getServletResponse().getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    void beforeHandshake_invalidToken_rejectsHandshake() {
        when(jwtService.parseUserId("bad-token")).thenThrow(new UnauthorizedException("Invalid or expired token"));

        ServerHttpRequest request = requestWithQuery("/ws?token=bad-token");
        ServletServerHttpResponse response = response();
        Map<String, Object> attributes = new HashMap<>();

        boolean result = interceptor.beforeHandshake(request, response, webSocketHandler, attributes);

        assertThat(result).isFalse();
        assertThat(attributes).isEmpty();
        assertThat(response.getServletResponse().getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    private ServerHttpRequest requestWithQuery(String uriWithQuery) {
        String[] parts = uriWithQuery.split("\\?", 2);
        MockHttpServletRequest mockRequest = new MockHttpServletRequest("GET", parts[0]);
        if (parts.length > 1) {
            mockRequest.setQueryString(parts[1]);
            for (String param : parts[1].split("&")) {
                String[] kv = param.split("=", 2);
                mockRequest.addParameter(kv[0], kv.length > 1 ? kv[1] : "");
            }
        }
        return new ServletServerHttpRequest(mockRequest);
    }

    private ServletServerHttpResponse response() {
        return new ServletServerHttpResponse(new MockHttpServletResponse());
    }
}
