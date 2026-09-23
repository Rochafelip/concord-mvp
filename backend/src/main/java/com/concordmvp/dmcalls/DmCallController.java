package com.concordmvp.dmcalls;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.dmcalls.dto.DmCallInviteResponse;
import com.concordmvp.media.dto.VoiceTokenResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST endpoints for 1:1 calls between friends — ring/accept/decline/cancel signaling, plus
 * separate token issuance so a LiveKit credential never rides inside a WebSocket broadcast (see
 * docs/superpowers/specs/2026-09-23-dm-call-design.md).
 */
@RestController
public class DmCallController {

    private final DmCallService dmCallService;

    public DmCallController(DmCallService dmCallService) {
        this.dmCallService = dmCallService;
    }

    @PostMapping("/api/v1/dm/{otherUserId}/calls/invite")
    public DmCallInviteResponse invite(@PathVariable UUID otherUserId) {
        UUID callId = dmCallService.invite(CurrentUser.id(), otherUserId);
        return new DmCallInviteResponse(callId);
    }

    @PostMapping("/api/v1/dm/calls/{callId}/accept")
    public VoiceTokenResponse accept(@PathVariable UUID callId) {
        return dmCallService.accept(callId, CurrentUser.id());
    }

    @PostMapping("/api/v1/dm/calls/{callId}/decline")
    public void decline(@PathVariable UUID callId) {
        dmCallService.decline(callId, CurrentUser.id());
    }

    @PostMapping("/api/v1/dm/calls/{callId}/cancel")
    public void cancel(@PathVariable UUID callId) {
        dmCallService.cancel(callId, CurrentUser.id());
    }

    @PostMapping("/api/v1/dm/calls/{callId}/token")
    public VoiceTokenResponse token(@PathVariable UUID callId) {
        return dmCallService.token(callId, CurrentUser.id());
    }
}
