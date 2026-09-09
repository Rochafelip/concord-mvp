package com.concordmvp.messages;

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
 * Serves previously uploaded chat attachments from disk. Deliberately reachable without
 * authentication (see {@code SecurityConfig}'s permitAll entry for this same path) — access
 * relies on the random UUID filename being unguessable, the same trust model as a shareable link.
 *
 * <p>Only the four known image extensions are served with a content-type that lets the browser
 * render them inline; every other file is forced to download via {@code Content-Disposition:
 * attachment} regardless of its actual content — an uploaded HTML/SVG file containing a script
 * must never execute in this app's origin just because someone opened its URL directly.
 */
@RestController
public class AttachmentServingController {

    private static final Set<String> INLINE_IMAGE_EXTENSIONS = Set.of("jpg", "png", "gif", "webp");

    private final Path uploadsDir;

    public AttachmentServingController(@Value("${app.uploads.dir}") String uploadsDir) {
        this.uploadsDir = Path.of(uploadsDir).toAbsolutePath().normalize();
    }

    @GetMapping("/api/v1/uploads/{filename:.+}")
    public ResponseEntity<Resource> serve(@PathVariable String filename) throws MalformedURLException {
        Path path = uploadsDir.resolve(filename).normalize();
        if (!path.startsWith(uploadsDir) || !Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("File not found: " + filename);
        }

        Resource resource = new UrlResource(path.toUri());
        String extension = extensionOf(filename);

        if (INLINE_IMAGE_EXTENSIONS.contains(extension)) {
            MediaType contentType = "jpg".equals(extension)
                    ? MediaType.IMAGE_JPEG
                    : MediaType.parseMediaType("image/" + extension);
            return ResponseEntity.ok().contentType(contentType).body(resource);
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
