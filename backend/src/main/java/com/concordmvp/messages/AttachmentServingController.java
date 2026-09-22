package com.concordmvp.messages;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.common.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

/**
 * Serves previously uploaded chat attachments from disk. Requires authentication, and the
 * requester must be able to see the channel the attachment was posted in — same check as
 * reading the message itself, via {@link MessageService#requireAttachmentAccess} (security audit
 * A4; previously relied only on the UUID filename being unguessable).
 *
 * <p>Known image extensions and PDF are served inline for preview; every other file is forced to
 * download via {@code Content-Disposition: attachment} regardless of its actual content — an
 * uploaded HTML/SVG file containing a script must never execute in this app's origin.
 */
@RestController
public class AttachmentServingController {

    private static final Set<String> INLINE_IMAGE_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "gif", "webp", "bmp", "avif");

    private final Path uploadsDir;
    private final MessageService messageService;

    public AttachmentServingController(@Value("${app.uploads.dir}") String uploadsDir, MessageService messageService) {
        this.uploadsDir = Path.of(uploadsDir).toAbsolutePath().normalize();
        this.messageService = messageService;
    }

    @GetMapping("/api/v1/uploads/{filename:.+}")
    public ResponseEntity<Resource> serve(@PathVariable String filename) throws MalformedURLException {
        Path path = uploadsDir.resolve(filename).normalize();
        if (!path.startsWith(uploadsDir) || !Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }

        messageService.requireAttachmentAccess("/api/v1/uploads/" + filename, CurrentUser.id());

        Resource resource = new UrlResource(path.toUri());
        String extension = extensionOf(filename);

        if (INLINE_IMAGE_EXTENSIONS.contains(extension)) {
            MediaType contentType = "jpg".equals(extension)
                    ? MediaType.IMAGE_JPEG
                    : MediaType.parseMediaType("image/" + extension);
            return ResponseEntity.ok().contentType(contentType).body(resource);
        }
        if ("pdf".equals(extension)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                    .body(resource);
        }

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment")
                .body(resource);
    }

    private String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase();
    }
}
