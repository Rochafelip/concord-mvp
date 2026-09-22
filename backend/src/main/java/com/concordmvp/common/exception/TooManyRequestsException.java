package com.concordmvp.common.exception;

/**
 * Thrown when a caller is rate-limited. Maps to HTTP 429.
 */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
