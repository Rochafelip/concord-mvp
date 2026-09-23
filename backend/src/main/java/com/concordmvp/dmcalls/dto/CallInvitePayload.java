package com.concordmvp.dmcalls.dto;

import com.concordmvp.users.dto.UserSummaryResponse;

import java.util.UUID;

/** {@code CALL_INVITE} WS payload, broadcast only to the callee. */
public record CallInvitePayload(UUID callId, UserSummaryResponse caller) {
}
