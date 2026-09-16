package com.concordmvp.messages;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Deletes the stored files behind a message's attachments. The {@code message_attachments} rows
 * themselves are removed by the {@code ON DELETE CASCADE} on their {@code message_id}; only the
 * bytes on disk need this explicit pass, because nothing in the database owns them.
 */
@Service
public class AttachmentCleanupService {

    private static final Pattern UPLOAD_URL =
            Pattern.compile("^/api/v1/uploads/([A-Za-z0-9._-]{1,100})$");

    private final MessageAttachmentRepository messageAttachmentRepository;
    private final Path uploadsDir;

    public AttachmentCleanupService(MessageAttachmentRepository messageAttachmentRepository,
                                     @Value("${app.uploads.dir}") String uploadsDir) {
        this.messageAttachmentRepository = messageAttachmentRepository;
        this.uploadsDir = Path.of(uploadsDir).toAbsolutePath().normalize();
    }

    /**
     * Must be called BEFORE the messages are deleted — once they are gone the cascade has already
     * taken their attachment rows with it, leaving no way to find the files.
     */
    public void deleteForMessages(Collection<UUID> messageIds) {
        if (messageIds.isEmpty()) {
            return;
        }

        List<MessageAttachment> attachments =
                messageAttachmentRepository.findByMessageIdInOrderByMessageIdAscPositionAsc(messageIds);

        for (MessageAttachment attachment : attachments) {
            var match = UPLOAD_URL.matcher(attachment.getUrl());
            if (!match.matches()) {
                continue;
            }

            try {
                Files.deleteIfExists(uploadsDir.resolve(match.group(1)).normalize());
            } catch (IOException e) {
                throw new IllegalStateException("Failed to delete message attachment", e);
            }
        }
    }
}
