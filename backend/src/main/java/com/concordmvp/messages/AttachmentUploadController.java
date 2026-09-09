package com.concordmvp.messages;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.messages.dto.AttachmentUploadResponse;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * Uploads a file to attach to a chat message. Only the resulting URL travels over the
 * {@code MESSAGE_CREATE} WebSocket event afterwards — the bytes themselves go through this REST
 * endpoint, per AGENTS.md's "do not send media through WebSocket".
 */
@RestController
public class AttachmentUploadController {

    private final AttachmentUploadService attachmentUploadService;

    public AttachmentUploadController(AttachmentUploadService attachmentUploadService) {
        this.attachmentUploadService = attachmentUploadService;
    }

    @PostMapping("/api/v1/channels/{channelId}/attachments")
    public AttachmentUploadResponse upload(@PathVariable UUID channelId,
                                            @RequestParam("file") MultipartFile file) {
        UploadedAttachment uploaded = attachmentUploadService.upload(channelId, CurrentUser.id(), file);
        return new AttachmentUploadResponse(uploaded.url(), uploaded.fileName(), uploaded.fileSize());
    }
}
