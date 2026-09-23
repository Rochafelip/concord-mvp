package com.concordmvp.dmcalls;

/** How a 1:1 call invite was resolved — see {@code dmcalls.dto.CallResolvedPayload}. */
public enum CallOutcome {
    ACCEPTED,
    DECLINED,
    CANCELLED
}
