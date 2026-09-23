package com.concordmvp.dm;

import com.concordmvp.common.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST endpoints for which DM conversations are visible in the current user's list — see
 * docs/superpowers/specs/2026-09-23-dm-conversation-visibility-design.md. Separate from
 * {@link DmMessageController}: sending a message and explicitly opening a chat are two
 * different triggers for the same visibility flag.
 */
@RestController
public class DmConversationController {

    private final DmConversationStateService dmConversationStateService;

    public DmConversationController(DmConversationStateService dmConversationStateService) {
        this.dmConversationStateService = dmConversationStateService;
    }

    @GetMapping("/api/v1/dm/conversations")
    public List<UUID> listConversations() {
        return dmConversationStateService.listVisibleConversationIds(CurrentUser.id());
    }

    @PostMapping("/api/v1/dm/{otherUserId}/open")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void open(@PathVariable UUID otherUserId) {
        dmConversationStateService.openConversation(CurrentUser.id(), otherUserId);
    }
}
