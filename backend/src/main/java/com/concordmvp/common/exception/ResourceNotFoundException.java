package com.concordmvp.common.exception;

/**
 * Thrown when a requested resource does not exist. Maps to HTTP 404.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
