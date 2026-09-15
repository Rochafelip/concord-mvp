package com.concordmvp.messages.dto;

/**
 * One attachment inside an inbound {@link SendMessageRequest}. The {@code url} must be one the
 * upload endpoint just handed back — {@code MessageService} re-validates its shape rather than
 * trusting the client.
 */
public record AttachmentRequest(
        String url,
        String fileName,
        Long fileSize
) {
}
