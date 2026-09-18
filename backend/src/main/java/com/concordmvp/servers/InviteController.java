package com.concordmvp.servers;

import com.concordmvp.servers.dto.InvitePreview;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public invite landing page endpoint — reachable without auth (see SecurityConfig's
 * permitAll entry for {@code /api/v1/invites/**}), separate from ServerController's
 * owner/MANAGE_INVITES-gated invite endpoints.
 */
@RestController
@RequestMapping("/api/v1/invites")
public class InviteController {

    private final ServerService serverService;

    public InviteController(ServerService serverService) {
        this.serverService = serverService;
    }

    @GetMapping("/{code}")
    public InvitePreview getInvitePreview(@PathVariable String code) {
        return serverService.getInvitePreview(code);
    }
}
