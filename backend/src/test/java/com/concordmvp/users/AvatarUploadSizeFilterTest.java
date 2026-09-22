package com.concordmvp.users;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AvatarUploadSizeFilterTest {

    private static final long MAX_SIZE = 5 * 1024 * 1024;
    private static final String AVATAR_PATH = "/api/v1/users/me/avatar";

    @Mock
    private FilterChain filterChain;

    private AvatarUploadSizeFilter filter;

    @BeforeEach
    void setUp() {
        filter = new AvatarUploadSizeFilter(MAX_SIZE);
    }

    @Test
    void oversizedContentLength_onTheAvatarUploadPath_rejectsWith413_withoutContinuingTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", AVATAR_PATH);
        request.setContent(new byte[(int) MAX_SIZE + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(413);
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    void contentLengthWithinTheLimit_continuesTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", AVATAR_PATH);
        request.setContent(new byte[(int) MAX_SIZE]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void oversizedContentLength_onADifferentPath_continuesTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/channels/c1/attachments");
        request.setContent(new byte[(int) MAX_SIZE + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void oversizedContentLength_withADifferentMethod_continuesTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", AVATAR_PATH);
        request.setContent(new byte[(int) MAX_SIZE + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void missingContentLength_continuesTheChain() throws Exception {
        // No Content-Length set (defaults to -1, e.g. a chunked-transfer request) — still hits
        // the global 150MB multipart cap and AvatarStorageService's own check downstream.
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", AVATAR_PATH);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }
}
