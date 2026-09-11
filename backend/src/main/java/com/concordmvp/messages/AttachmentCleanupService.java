package com.concordmvp.messages;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.regex.Pattern;

@Service
public class AttachmentCleanupService {

    private static final Pattern UPLOAD_URL =
            Pattern.compile("^/api/v1/uploads/([A-Za-z0-9._-]{1,100})$");

    private final Path uploadsDir;

    public AttachmentCleanupService(@Value("${app.uploads.dir}") String uploadsDir) {
        this.uploadsDir = Path.of(uploadsDir).toAbsolutePath().normalize();
    }

    public void deleteForMessages(Collection<Message> messages) {
        for (Message message : messages) {
            String imageUrl = message.getImageUrl();
            if (imageUrl == null) {
                continue;
            }

            var match = UPLOAD_URL.matcher(imageUrl);
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
