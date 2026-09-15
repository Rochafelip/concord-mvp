package com.concordmvp.messages.dto;

/**
 * One attachment as it appears inside a {@link MessageResponse}, in both the REST history
 * response and the {@code MESSAGE_CREATE} WebSocket broadcast. Only the URL travels over the
 * socket — the bytes go through the upload endpoint (AGENTS.md: "do not send media through
 * WebSocket").
 */
public record AttachmentResponse(
        String url,
        String fileName,
        Long fileSize
) {
}
