package com.concordmvp.messages;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * One file attached to a message. Deliberately NOT mapped as a {@code @OneToMany} on
 * {@link Message}: {@link MessageService#getHistory} loads a page of up to 100 messages at a
 * time and would issue one query per message to walk a lazy association. Attachments are instead
 * fetched in a single batch through {@link MessageAttachmentRepository}, the same way that class
 * already batches message authors.
 *
 * <p>{@code position} preserves the order the sender chose; {@code (message_id, position)} is
 * unique. Rows are removed by the {@code ON DELETE CASCADE} on {@code message_id} when the
 * message itself is deleted — the stored files are a separate concern, handled by
 * {@link AttachmentCleanupService}.
 */
@Entity
@Table(name = "message_attachments")
public class MessageAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Column(nullable = false, length = 500)
    private String url;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "position", nullable = false)
    private int position;

    public MessageAttachment() {
    }

    public MessageAttachment(UUID messageId, String url, String fileName, Long fileSize, int position) {
        this.messageId = messageId;
        this.url = url;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getMessageId() {
        return messageId;
    }

    public void setMessageId(UUID messageId) {
        this.messageId = messageId;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }
}
