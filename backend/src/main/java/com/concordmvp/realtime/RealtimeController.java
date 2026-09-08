package com.concordmvp.realtime;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.realtime.dto.WsTicketResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issues short-lived tickets used to authenticate the {@code /ws} handshake — see
 * {@link WsTicketService}. Requires the normal {@code Authorization: Bearer <jwt>} header (this
 * path is authenticated by the default security rule, same as every other {@code /api/v1/**}
 * endpoint outside {@code /api/v1/auth/**} — see {@code SecurityConfig}).
 */
@RestController
@RequestMapping("/api/v1/realtime")
public class RealtimeController {

    private final WsTicketService wsTicketService;

    public RealtimeController(WsTicketService wsTicketService) {
        this.wsTicketService = wsTicketService;
    }

    @PostMapping("/ws-ticket")
    public WsTicketResponse issueWsTicket() {
        String ticket = wsTicketService.issue(CurrentUser.id());
        return new WsTicketResponse(ticket);
    }
}
