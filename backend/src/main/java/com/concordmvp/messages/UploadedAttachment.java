package com.concordmvp.messages;

/**
 * Result of a successful upload: the URL to fetch it from, the name to show/offer for download
 * (the client's original filename when available, otherwise a fallback), and its size in bytes.
 */
public record UploadedAttachment(String url, String fileName, long fileSize) {
}
