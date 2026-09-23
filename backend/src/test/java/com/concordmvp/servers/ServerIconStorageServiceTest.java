package com.concordmvp.servers;

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

class ServerIconStorageServiceTest {

    @TempDir
    private Path uploadsDir;

    private ServerIconStorageService serverIconStorageService;

    @BeforeEach
    void setUp() throws IOException {
        serverIconStorageService = new ServerIconStorageService(uploadsDir.toString(), 5 * 1024 * 1024);
    }

    private byte[] pngBytes(int width, int height) throws IOException {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_BYTE_BINARY);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    @Test
    void store_validPng_writesFileAndReturnsStorageKey() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", pngBytes(64, 64));

        ServerIconStorageService.StoredIcon stored = serverIconStorageService.store(UUID.randomUUID(), file);

        assertThat(stored.storageKey()).endsWith(".png");
        assertThat(serverIconStorageService.resolve(stored.storageKey())).exists();
    }

    @Test
    void store_pngDeclaringDimensionsOverTheLimit_throwsBadRequest_withoutDecodingThePixels() throws IOException {
        byte[] oversized = pngBytes(4097, 4097);
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", oversized);

        assertThatThrownBy(() -> serverIconStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("4096");
    }

    @Test
    void store_contentTypeDoesNotMatchExtension_throwsBadRequest() throws IOException {
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/jpeg", pngBytes(16, 16));

        assertThatThrownBy(() -> serverIconStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void store_fileLargerThanMaxSize_throwsPayloadTooLarge() {
        byte[] tooLarge = new byte[6 * 1024 * 1024];
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", tooLarge);

        assertThatThrownBy(() -> serverIconStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(PayloadTooLargeException.class);
    }

    @Test
    void store_emptyFile_throwsBadRequest() {
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> serverIconStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void store_notActuallyAnImage_throwsBadRequest() {
        byte[] textContent = "this is not an image".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "icon.png", "image/png", textContent);

        assertThatThrownBy(() -> serverIconStorageService.store(UUID.randomUUID(), file))
                .isInstanceOf(BadRequestException.class);
    }
}
