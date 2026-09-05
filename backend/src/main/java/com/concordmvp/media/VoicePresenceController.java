package com.concordmvp.media;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.media.dto.VoicePresenceResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class VoicePresenceController {

    private final VoicePresenceService voicePresenceService;

    public VoicePresenceController(VoicePresenceService voicePresenceService) {
        this.voicePresenceService = voicePresenceService;
    }

    @GetMapping("/api/v1/servers/{serverId}/voice-presence")
    public List<VoicePresenceResponse> getVoicePresence(@PathVariable UUID serverId) {
        return voicePresenceService.getPresence(serverId, CurrentUser.id());
    }
}
