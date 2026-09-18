package com.concordmvp.servers;

import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.servers.dto.InvitePreview;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InviteControllerTest {

    @Mock
    private ServerService serverService;

    private InviteController inviteController;

    @BeforeEach
    void setUp() {
        inviteController = new InviteController(serverService);
    }

    @Test
    void getInvitePreview_validCode_returnsPreview() {
        InvitePreview preview = new InvitePreview(UUID.randomUUID(), "Test Server", 3);
        when(serverService.getInvitePreview("code123")).thenReturn(preview);

        InvitePreview result = inviteController.getInvitePreview("code123");

        assertThat(result).isEqualTo(preview);
    }

    @Test
    void getInvitePreview_invalidCode_propagatesNotFound() {
        when(serverService.getInvitePreview("bad-code"))
                .thenThrow(new ResourceNotFoundException("Invalid invite code"));

        assertThatThrownBy(() -> inviteController.getInvitePreview("bad-code"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
