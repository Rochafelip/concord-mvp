package com.concordmvp.users;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.PayloadTooLargeException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AvatarStorageServiceTest {

    @TempDir
    private Path uploadsDir;

    private AvatarStorageService avatarStorageService;

    @BeforeEach
    void setUp() throws IOException {
        avatarStorageService = new AvatarStorageService(uploadsDir.toString(), 5 * 1024 * 1024);
    }

    private byte[] pngBytes(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_BYTE_BINARY);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    @Test
    void store_validPng_writesFileAndReturnsStorageKey() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", pngBytes(64, 64));

        AvatarStorageService.StoredAvatar stored = avatarStorageService.store(UUID.randomUUID(), file);

        assertThat(stored.storageKey()).endsWith(".png");
        assertThat(avatarStorageService.resolve(stored.storageKey())).exists();
    }

    @Test
    void store_pngDeclaringDimensionsOverTheLimit_throwsBadRequest_withoutDecodingThePixels() throws IOException {
        // A 1-bit-per-pixel bitmap keeps this fixture's own memory use trivial (~2 MB), but the
        // point under test is that AvatarStorageService rejects it off the header alone — a real
        // decompression-bomb payload is a tiny compressed file that only *declares* huge
        // dimensions, so the service must never reach ImageIO.read/BufferedImage for it.
        byte[] oversized = pngBytes(4097, 4097);
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", oversized);

        assertThatThrownBy(() -> avatarStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("4096");
    }

    @Test
    void store_pngAtExactlyTheLimit_isAccepted() throws IOException {
        MockMultipartFile file =
                new MockMultipartFile("file", "avatar.png", "image/png", pngBytes(4096, 4096));

        AvatarStorageService.StoredAvatar stored = avatarStorageService.store(UUID.randomUUID(), file);

        assertThat(avatarStorageService.resolve(stored.storageKey())).exists();
    }

    @Test
    void store_contentTypeDoesNotMatchExtension_throwsBadRequest() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/jpeg", pngBytes(16, 16));

        assertThatThrownBy(() -> avatarStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void store_fileLargerThanMaxSize_throwsPayloadTooLarge() {
        byte[] tooLarge = new byte[6 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", tooLarge);

        assertThatThrownBy(() -> avatarStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(PayloadTooLargeException.class);
    }

    @Test
    void store_emptyFile_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> avatarStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void store_notActuallyAnImage_throwsBadRequest() {
        byte[] textContent = "this is not an image".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", textContent);

        assertThatThrownBy(() -> avatarStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class);
    }
}
