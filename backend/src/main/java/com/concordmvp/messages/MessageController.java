package com.concordmvp.messages;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.messages.dto.MessageResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read-only REST access to message history. There is deliberately NO {@code POST} endpoint here
 * — sending a message happens over WebSocket only, via {@code MESSAGE_CREATE}
 * (docs/ARCHITECTURE.md §18); see {@code realtime.ChatWebSocketHandler}.
 *
 * <p>Pagination uses a compound {@code (before, beforeId)} cursor rather than a bare timestamp:
 * two messages can share the exact same {@code createdAt}, so a timestamp alone can't
 * unambiguously mark a page boundary. Clients requesting an older page pass both {@code before}
 * and {@code beforeId} from the oldest message of the page they already have; {@code beforeId}
 * is required whenever {@code before} is provided.
 */
@RestController
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping("/api/v1/channels/{channelId}/messages")
    public List<MessageResponse> getHistory(@PathVariable UUID channelId,
                                             @RequestParam(required = false) Instant before,
                                             @RequestParam(required = false) UUID beforeId,
                                             @RequestParam(required = false) Integer limit) {
        int effectiveLimit = limit == null ? 0 : limit;
        return messageService.getHistory(channelId, before, beforeId, effectiveLimit, CurrentUser.id());
    }
}
