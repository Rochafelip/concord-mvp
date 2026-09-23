package com.concordmvp.servers;

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
class ServerIconUploadSizeFilterTest {

    private static final long MAX_SIZE = 5 * 1024 * 1024;
    private static final String ICON_PATH = "/api/v1/servers/11111111-1111-1111-1111-111111111111/icon";

    @Mock
    private FilterChain filterChain;

    private ServerIconUploadSizeFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ServerIconUploadSizeFilter(MAX_SIZE);
    }

    @Test
    void oversizedContentLength_onTheIconUploadPath_rejectsWith413_withoutContinuingTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", ICON_PATH);
        request.setContent(new byte[(int) MAX_SIZE + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        assertThat(response.getStatus()).isEqualTo(413);
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    void contentLengthWithinTheLimit_continuesTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", ICON_PATH);
        request.setContent(new byte[(int) MAX_SIZE]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void oversizedContentLength_onADifferentPath_continuesTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/v1/users/me/avatar");
        request.setContent(new byte[(int) MAX_SIZE + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void oversizedContentLength_withADifferentMethod_continuesTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", ICON_PATH);
        request.setContent(new byte[(int) MAX_SIZE + 1]);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }

    @Test
    void missingContentLength_continuesTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", ICON_PATH);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
    }
}
