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
 * Validates and stores an image uploaded for a chat message. Reuses
 * {@link ChannelService#getChannel(java.util.UUID, java.util.UUID)} for the same
 * 404-if-missing/403-if-not-a-member check {@link MessageService} already relies on — only a
 * member of the channel's server may attach an image to it.
 *
 * <p>Validation inspects the file's actual byte signature rather than trusting its filename
 * extension or declared {@code Content-Type} — a renamed non-image file must be rejected. This
 * also sidesteps the JDK's built-in {@code ImageIO}, which has no WebP reader, without adding a
 * new dependency just to validate four known formats.
 */
@Service
public class ImageUploadService {

    static final long MAX_FILE_SIZE_BYTES = 8L * 1024 * 1024;

    private final ChannelService channelService;
    private final Path uploadsDir;

    public ImageUploadService(ChannelService channelService,
                               @Value("${app.uploads.dir}") String uploadsDir) throws IOException {
        this.channelService = channelService;
        this.uploadsDir = Path.of(uploadsDir);
        Files.createDirectories(this.uploadsDir);
    }

    public String upload(UUID channelId, UUID requesterId, MultipartFile file) {
        channelService.getChannel(channelId, requesterId);

        if (file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new BadRequestException("File exceeds the 8 MB limit");
        }

        String extension = detectImageExtension(file);
        String filename = UUID.randomUUID() + "." + extension;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, uploadsDir.resolve(filename));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store uploaded image", e);
        }

        return "/api/v1/uploads/" + filename;
    }

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

        throw new BadRequestException("Unsupported file type. Allowed: JPEG, PNG, GIF, WebP");
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
