package com.concordmvp.common;

import java.time.Instant;

/**
 * Standard shape for API error responses.
 */
public record ApiError(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path
) {
}
