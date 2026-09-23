package com.concordmvp.dmcalls.dto;

import com.concordmvp.dmcalls.CallOutcome;

import java.util.UUID;

/**
 * {@code CALL_RESOLVED} WS payload — one generic event covering every way a call invite ends,
 * discriminated by {@code outcome} (see docs/superpowers/specs/2026-09-23-dm-call-design.md).
 * {@code roomName} is only present when {@code outcome} is {@code ACCEPTED}.
 */
public record CallResolvedPayload(UUID callId, CallOutcome outcome, String roomName) {
}
