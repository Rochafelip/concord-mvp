package com.concordmvp.dm;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.dm.dto.DmMessageResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read-only REST access to DM history. Sending happens over WebSocket only, via
 * {@code DM_MESSAGE_CREATE} — same shape as {@code messages.MessageController}'s relationship to
 * {@code MESSAGE_CREATE}; see {@code realtime.ChatWebSocketHandler}.
 */
@RestController
public class DmMessageController {

    private final DmMessageService dmMessageService;

    public DmMessageController(DmMessageService dmMessageService) {
        this.dmMessageService = dmMessageService;
    }

    @GetMapping("/api/v1/dm/{otherUserId}/messages")
    public List<DmMessageResponse> getHistory(@PathVariable UUID otherUserId,
                                               @RequestParam(required = false) Instant before,
                                               @RequestParam(required = false) UUID beforeId,
                                               @RequestParam(required = false) Integer limit) {
        int effectiveLimit = limit == null ? 0 : limit;
        return dmMessageService.getHistory(CurrentUser.id(), otherUserId, before, beforeId, effectiveLimit);
    }
}
