package com.concordmvp.auth;

import com.concordmvp.common.exception.UnauthorizedException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthFilterTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private FilterChain filterChain;

    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthFilter(jwtService);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesUser_whenCookieHasValidToken() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtService.parseUserId("valid-token")).thenReturn(userId);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(JwtService.COOKIE_NAME, "valid-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isEqualTo(userId);
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void leavesRequestUnauthenticated_whenCookieIsMissing() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void leavesRequestUnauthenticated_whenTokenIsInvalid() throws Exception {
        when(jwtService.parseUserId("bad-token")).thenThrow(new UnauthorizedException("Invalid or expired token"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(JwtService.COOKIE_NAME, "bad-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }
}
