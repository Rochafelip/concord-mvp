package com.concordmvp.messages;

import com.concordmvp.channels.ChannelService;
import com.concordmvp.common.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;

/**
 * Validates and stores a file uploaded for a chat message. Reuses
 * {@link ChannelService#getChannel(java.util.UUID, java.util.UUID)} for the same
 * 404-if-missing/403-if-not-a-member check {@link MessageService} already relies on.
 *
 * <p>Any file type is accepted (project owner's explicit request), but the size limit differs:
 * a file whose content matches one of four known image signatures (JPEG/PNG/GIF/WebP — inspected
 * by magic bytes, not filename/declared Content-Type, so a renamed non-image file isn't
 * misclassified) is capped at 8MB and rendered inline by the frontend; anything else is capped at
 * 50MB and rendered as a downloadable file chip. Serving non-image files in a way that can't
 * execute in the browser (forced download) is handled by a separate serving component, not here —
 * this class only validates and stores bytes.
 */
@Service
public class AttachmentUploadService {

    static final long MAX_IMAGE_SIZE_BYTES = 8L * 1024 * 1024;
    static final long MAX_FILE_SIZE_BYTES = 50L * 1024 * 1024;

    private final ChannelService channelService;
    private final Path uploadsDir;

    public AttachmentUploadService(ChannelService channelService,
                                    @Value("${app.uploads.dir}") String uploadsDir) throws IOException {
        this.channelService = channelService;
        this.uploadsDir = Path.of(uploadsDir);
        Files.createDirectories(this.uploadsDir);
    }

    public UploadedAttachment upload(UUID channelId, UUID requesterId, MultipartFile file) {
        channelService.getChannel(channelId, requesterId);

        if (file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }

        String imageExtension = detectImageExtension(file);
        boolean isImage = imageExtension != null;
        long maxSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_FILE_SIZE_BYTES;

        if (file.getSize() > maxSize) {
            throw new BadRequestException(isImage
                    ? "Image exceeds the 8 MB limit"
                    : "File exceeds the 50 MB limit");
        }

        String storageExtension = isImage ? imageExtension : safeExtension(file.getOriginalFilename());
        String storageFilename = UUID.randomUUID() + (storageExtension.isEmpty() ? "" : "." + storageExtension);

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, uploadsDir.resolve(storageFilename));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store uploaded file", e);
        }

        String displayName = displayFileName(file.getOriginalFilename(), storageFilename);
        return new UploadedAttachment("/api/v1/uploads/" + storageFilename, displayName, file.getSize());
    }

    /**
     * Returns "jpg"/"png"/"gif"/"webp" if the file's content matches a known image signature, or
     * {@code null} if it doesn't look like any of the four supported image formats. Callers treat
     * a {@code null} result as "accept as a generic file," not as a rejection — any file type is
     * allowed as a generic attachment, only the size limit differs.
     */
    private String detectImageExtension(MultipartFile file) {
        byte[] header;
        try (InputStream in = file.getInputStream()) {
            header = in.readNBytes(12);
        } catch (IOException e) {
            throw new BadRequestException("Unable to read uploaded file");
        }

        if (startsWith(header, 0xFF, 0xD8, 0xFF)) {
            return "jpg";
        }
        if (startsWith(header, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
            return "png";
        }
        if (startsWith(header, 'G', 'I', 'F', '8')) {
            return "gif"; // covers both GIF87a and GIF89a
        }
        if (header.length == 12 && startsWith(header, 'R', 'I', 'F', 'F')
                && startsWith(Arrays.copyOfRange(header, 8, 12), 'W', 'E', 'B', 'P')) {
            return "webp";
        }
        return null;
    }

    /**
     * Extracts a safe, lowercase extension (letters/digits only, max 10 chars) from the client's
     * original filename, for a non-image file, so the stored file keeps a recognizable type
     * without trusting the original filename for anything beyond this cosmetic suffix. Returns
     * {@code ""} if there's no usable extension.
     */
    private String safeExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int dot = originalFilename.lastIndexOf('.');
        if (dot < 0 || dot == originalFilename.length() - 1) {
            return "";
        }
        String candidate = originalFilename.substring(dot + 1).toLowerCase();
        if (candidate.length() > 10 || !candidate.chars().allMatch(Character::isLetterOrDigit)) {
            return "";
        }
        return candidate;
    }

    /**
     * The name shown to other users and offered as the browser's suggested download filename —
     * the client's original filename when present and non-blank, otherwise the storage filename.
     * Never used as a filesystem path itself; only ever rendered as text or passed to the
     * browser's download-filename hint.
     */
    private String displayFileName(String originalFilename, String storageFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return storageFilename;
        }
        return originalFilename;
    }

    private boolean startsWith(byte[] data, int... expected) {
        if (data.length < expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((data[i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }
}
