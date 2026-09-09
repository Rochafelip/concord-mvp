package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImageUploadServiceTest {

    @Mock
    private ChannelService channelService;

    @TempDir
    private Path uploadsDir;

    private ImageUploadService imageUploadService;

    @BeforeEach
    void setUp() throws IOException {
        imageUploadService = new ImageUploadService(channelService, uploadsDir.toString());
    }

    private Channel channel(UUID id, UUID serverId) {
        Channel channel = new Channel();
        channel.setId(id);
        channel.setServerId(serverId);
        channel.setName("general");
        channel.setType(ChannelType.TEXT);
        return channel;
    }

    private byte[] pngBytes() {
        // Real PNG signature (8 bytes) + a few arbitrary bytes — the service only inspects the
        // header, it never needs a fully valid/decodable image body.
        return new byte[] {
            (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4
        };
    }

    private byte[] jpegBytes() {
        return new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3 };
    }

    private byte[] gifBytes() {
        return "GIF89a-rest-of-file".getBytes();
    }

    private byte[] webpBytes() {
        byte[] bytes = new byte[12];
        System.arraycopy("RIFF".getBytes(), 0, bytes, 0, 4);
        bytes[4] = 0;
        bytes[5] = 0;
        bytes[6] = 0;
        bytes[7] = 0;
        System.arraycopy("WEBP".getBytes(), 0, bytes, 8, 4);
        return bytes;
    }

    @Test
    void upload_validPng_returnsUrlUnderUploadsPath_andWritesFileToDisk() throws IOException {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", pngBytes());

        String url = imageUploadService.upload(channelId, requesterId, file);

        assertThat(url).startsWith("/api/v1/uploads/").endsWith(".png");
        String filename = url.substring("/api/v1/uploads/".length());
        assertThat(Files.exists(uploadsDir.resolve(filename))).isTrue();
    }

    @Test
    void upload_validJpeg_returnsJpgExtension() throws IOException {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", jpegBytes());

        String url = imageUploadService.upload(channelId, requesterId, file);

        assertThat(url).endsWith(".jpg");
    }

    @Test
    void upload_validGif_returnsGifExtension() throws IOException {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.gif", "image/gif", gifBytes());

        String url = imageUploadService.upload(channelId, requesterId, file);

        assertThat(url).endsWith(".gif");
    }

    @Test
    void upload_validWebp_returnsWebpExtension() throws IOException {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.webp", "image/webp", webpBytes());

        String url = imageUploadService.upload(channelId, requesterId, file);

        assertThat(url).endsWith(".webp");
    }

    @Test
    void upload_nonImageContent_rejected_evenWithImageFilenameAndDeclaredContentType() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        // Plain text bytes, but filename and Content-Type both claim to be a PNG.
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", "not an image".getBytes());

        assertThatThrownBy(() -> imageUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void upload_oversizedFile_rejected() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        byte[] oversized = new byte[8 * 1024 * 1024 + 1];
        System.arraycopy(pngBytes(), 0, oversized, 0, pngBytes().length);
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", oversized);

        assertThatThrownBy(() -> imageUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void upload_emptyFile_rejected() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> imageUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void upload_nonMemberOfChannelServer_propagatesForbidden() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ForbiddenException("Not a member of this server"));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", pngBytes());

        assertThatThrownBy(() -> imageUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void upload_unknownChannel_propagatesNotFound() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ResourceNotFoundException("Channel not found: " + channelId));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", pngBytes());

        assertThatThrownBy(() -> imageUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
