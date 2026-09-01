package com.concordmvp.common.exception;

/**
 * Thrown when a well-formed request references invalid business state (as opposed to failing
 * Bean Validation, or referencing a resource that doesn't exist at all). Maps to HTTP 400.
 */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
