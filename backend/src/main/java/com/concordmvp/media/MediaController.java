package com.concordmvp.media;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.media.dto.VoiceTokenResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class MediaController {

    private final MediaService mediaService;

    public MediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    @PostMapping("/api/v1/channels/{channelId}/voice/token")
    public VoiceTokenResponse issueVoiceToken(@PathVariable UUID channelId) {
        return mediaService.issueVoiceToken(channelId, CurrentUser.id());
    }
}
