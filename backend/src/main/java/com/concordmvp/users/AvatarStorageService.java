package com.concordmvp.users;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.PayloadTooLargeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Iterator;
import java.util.Locale;
import java.util.UUID;

@Service
public class AvatarStorageService {
    /**
     * A compressed file well under {@code maxSize} can still declare pixel dimensions that
     * decode to gigabytes of memory (a "decompression bomb") — checked against the header via
     * {@link ImageReader#getWidth}/{@link ImageReader#getHeight}, never against a fully decoded
     * {@link java.awt.image.BufferedImage}, so an oversized image is rejected before that
     * decode ever happens. 4096px is far beyond anything an avatar needs.
     */
    private static final int MAX_AVATAR_DIMENSION_PX = 4096;

    private final Path root;
    private final long maxSize;

    public AvatarStorageService(
            @Value("${app.uploads.dir}") String uploadsDir,
            @Value("${app.uploads.avatar-max-size:5242880}") long maxSize
    ) throws IOException {
        root = Path.of(uploadsDir).toAbsolutePath().normalize().resolve("avatars").normalize();
        this.maxSize = maxSize;
        Files.createDirectories(root);
    }

    public StoredAvatar store(UUID userId, MultipartFile file) {
        String extension = extension(file.getOriginalFilename());
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (file.isEmpty()) throw new BadRequestException("Avatar file is empty");
        if (file.getSize() > maxSize) throw new PayloadTooLargeException("Avatar exceeds the 5 MB limit");
        String expectedType = switch (extension) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            default -> null;
        };
        if (expectedType == null || !expectedType.equals(contentType)) {
            throw new BadRequestException("Avatar must be a JPEG, PNG, GIF, or WebP image");
        }

        Path userRoot = root.resolve(userId.toString()).normalize();
        if (!userRoot.startsWith(root)) throw new BadRequestException("Invalid avatar path");
        Path target = userRoot.resolve(UUID.randomUUID() + "." + (extension.equals("jpeg") ? "jpg" : extension)).normalize();
        if (!target.startsWith(userRoot)) throw new BadRequestException("Invalid avatar path");
        try {
            if (!isDecodable(file, extension)) throw new BadRequestException("Avatar content is invalid");
            Files.createDirectories(userRoot);
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return new StoredAvatar(root.relativize(target).toString(), contentType);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store avatar", ex);
        }
    }

    public Path resolve(String storageKey) {
        Path resolved = root.resolve(storageKey).normalize();
        if (!resolved.startsWith(root)) throw new BadRequestException("Invalid avatar path");
        return resolved;
    }

    public void delete(String storageKey) throws IOException {
        if (storageKey != null) Files.deleteIfExists(resolve(storageKey));
    }

    private boolean isDecodable(MultipartFile file, String extension) throws IOException {
        if (extension.equals("webp")) {
            byte[] header = file.getInputStream().readNBytes(32);
            return header.length >= 16 && ascii(header, 0, "RIFF") && ascii(header, 8, "WEBP")
                    && (ascii(header, 12, "VP8 ") || ascii(header, 12, "VP8L") || ascii(header, 12, "VP8X"));
        }
        try (ImageInputStream iis = ImageIO.createImageInputStream(file.getInputStream())) {
            if (iis == null) return false;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) return false;
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0) return false;
                if (width > MAX_AVATAR_DIMENSION_PX || height > MAX_AVATAR_DIMENSION_PX) {
                    throw new BadRequestException(
                            "Avatar dimensions exceed the " + MAX_AVATAR_DIMENSION_PX + "px limit");
                }
                return true;
            } finally {
                reader.dispose();
            }
        } catch (IOException ex) {
            return false;
        }
    }

    private String extension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private boolean ascii(byte[] bytes, int offset, String value) {
        if (bytes.length < offset + value.length()) return false;
        for (int i = 0; i < value.length(); i++) if (bytes[offset + i] != value.charAt(i)) return false;
        return true;
    }

    public record StoredAvatar(String storageKey, String contentType) {
    }
}
