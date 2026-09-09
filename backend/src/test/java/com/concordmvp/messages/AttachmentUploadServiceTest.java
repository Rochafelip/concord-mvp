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
class AttachmentUploadServiceTest {

    @Mock
    private ChannelService channelService;

    @TempDir
    private Path uploadsDir;

    private AttachmentUploadService attachmentUploadService;

    @BeforeEach
    void setUp() throws IOException {
        attachmentUploadService = new AttachmentUploadService(channelService, uploadsDir.toString());
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

    /**
     * Plain-ASCII, non-image content of an arbitrary size, built from a repeating text pattern
     * whose first 12 bytes never match any of the JPEG/PNG/GIF/WebP magic-byte signatures the
     * service checks for.
     */
    private byte[] nonImageBytes(int size) {
        byte[] pattern = "This is definitely not an image, just plain text content for a fake file. "
                .getBytes();
        byte[] result = new byte[size];
        for (int i = 0; i < size; i++) {
            result[i] = pattern[i % pattern.length];
        }
        return result;
    }

    @Test
    void upload_validPng_returnsUrlUnderUploadsPath_andWritesFileToDisk() throws IOException {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", pngBytes());

        UploadedAttachment result = attachmentUploadService.upload(channelId, requesterId, file);

        assertThat(result.url()).startsWith("/api/v1/uploads/").endsWith(".png");
        String filename = result.url().substring("/api/v1/uploads/".length());
        assertThat(Files.exists(uploadsDir.resolve(filename))).isTrue();
    }

    @Test
    void upload_validJpeg_returnsJpgExtension() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", jpegBytes());

        UploadedAttachment result = attachmentUploadService.upload(channelId, requesterId, file);

        assertThat(result.url()).endsWith(".jpg");
    }

    @Test
    void upload_oversizedImage_rejected() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        byte[] oversized = new byte[8 * 1024 * 1024 + 1];
        System.arraycopy(pngBytes(), 0, oversized, 0, pngBytes().length);
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", oversized);

        assertThatThrownBy(() -> attachmentUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void upload_nonImageFile_underFileLimit_succeeds_andPreservesOriginalFileNameAndSize() throws IOException {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        byte[] content = nonImageBytes(1024);
        MockMultipartFile file = new MockMultipartFile("file", "report.pdf", "application/pdf", content);

        UploadedAttachment result = attachmentUploadService.upload(channelId, requesterId, file);

        assertThat(result.fileName()).isEqualTo("report.pdf");
        assertThat(result.fileSize()).isEqualTo(content.length);
        assertThat(result.url()).startsWith("/api/v1/uploads/").endsWith(".pdf");
        String filename = result.url().substring("/api/v1/uploads/".length());
        assertThat(Files.exists(uploadsDir.resolve(filename))).isTrue();
    }

    @Test
    void upload_nonImageFile_over8MBButUnder50MB_succeeds() {
        // Proves the higher 50MB limit applies to non-images, not the 8MB image limit: this file
        // is well over 8MB (which would reject an image) but comfortably under 50MB.
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        byte[] content = nonImageBytes(10 * 1024 * 1024);
        MockMultipartFile file = new MockMultipartFile("file", "report.pdf", "application/pdf", content);

        UploadedAttachment result = attachmentUploadService.upload(channelId, requesterId, file);

        assertThat(result.fileSize()).isEqualTo(content.length);
        assertThat(result.fileName()).isEqualTo("report.pdf");
    }

    @Test
    void upload_nonImageFile_over50MB_rejected() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        byte[] content = nonImageBytes(50 * 1024 * 1024 + 1);
        MockMultipartFile file = new MockMultipartFile("file", "report.pdf", "application/pdf", content);

        assertThatThrownBy(() -> attachmentUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void upload_emptyFile_rejected() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> attachmentUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void upload_nonMemberOfChannelServer_propagatesForbidden() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ForbiddenException("Not a member of this server"));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", pngBytes());

        assertThatThrownBy(() -> attachmentUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void upload_unknownChannel_propagatesNotFound() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ResourceNotFoundException("Channel not found: " + channelId));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", pngBytes());

        assertThatThrownBy(() -> attachmentUploadService.upload(channelId, requesterId, file))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void upload_nonImageFile_noExtensionInOriginalFilename_succeeds_withNoExtensionOnStorageFilename() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, UUID.randomUUID()));
        MockMultipartFile file = new MockMultipartFile("file", "README", "text/plain", nonImageBytes(1024));

        UploadedAttachment result = attachmentUploadService.upload(channelId, requesterId, file);

        assertThat(result.fileName()).isEqualTo("README");
        String storageFilename = result.url().substring("/api/v1/uploads/".length());
        assertThat(storageFilename).doesNotContain(".");
    }
}
