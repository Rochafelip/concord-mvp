package com.concordmvp.common.exception;

/**
 * Thrown when an authenticated user is not allowed to perform an action. Maps to HTTP 403.
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
