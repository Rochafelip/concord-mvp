package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.messages.dto.AttachmentRequest;
import com.concordmvp.messages.dto.AttachmentResponse;
import com.concordmvp.messages.dto.MessageResponse;
import com.concordmvp.messages.dto.MessageDeletedPayload;
import com.concordmvp.permissions.Permission;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import com.concordmvp.users.UserAvatarUrls;
import com.concordmvp.users.dto.UserSummaryResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Business logic for messages. Reuses {@link ChannelService#getChannel(UUID, UUID)} for the
 * "channel exists (404) + requester is a member of its server (403)" check rather than
 * re-deriving it from raw repositories — that check is already recommended for reuse by a prior
 * code review of the {@code channels} module.
 *
 * <p>Also reaches into {@code servers.ServerMemberRepository} and {@code users.UserRepository}
 * directly (same established cross-module pattern used elsewhere) to build the broadcast
 * recipient set and populate the message author's summary.
 */
@Service
public class MessageService {

    private static final int DEFAULT_HISTORY_LIMIT = 50;
    private static final int MAX_HISTORY_LIMIT = 100;
    private static final int MAX_CONTENT_LENGTH = 4000;
    private static final int MAX_FILE_NAME_LENGTH = 255;
    /** Matches Discord's per-message attachment cap; also bounds how much one message can
     * make the client render. Enforced here as well as in the composer. */
    private static final int MAX_ATTACHMENTS = 10;
    private static final Pattern IMAGE_URL_PATTERN = Pattern.compile("^/api/v1/uploads/[A-Za-z0-9._-]{1,100}$");

    private final MessageRepository messageRepository;
    private final MessageAttachmentRepository messageAttachmentRepository;
    private final ChannelService channelService;
    private final ServerMemberRepository serverMemberRepository;
    private final UserRepository userRepository;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final AttachmentCleanupService attachmentCleanupService;
    private final ChannelReadStateService channelReadStateService;
    private final PermissionService permissionService;
    private final ApplicationEventPublisher applicationEventPublisher;

    @Autowired
    public MessageService(MessageRepository messageRepository,
                           MessageAttachmentRepository messageAttachmentRepository,
                           ChannelService channelService,
                           ServerMemberRepository serverMemberRepository,
                           UserRepository userRepository,
                           RealtimeEventPublisher realtimeEventPublisher,
                           AttachmentCleanupService attachmentCleanupService,
                           PermissionService permissionService,
                           ChannelReadStateService channelReadStateService,
                           ApplicationEventPublisher applicationEventPublisher) {
        this.permissionService = permissionService;
        this.messageRepository = messageRepository;
        this.messageAttachmentRepository = messageAttachmentRepository;
        this.channelService = channelService;
        this.serverMemberRepository = serverMemberRepository;
        this.userRepository = userRepository;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.attachmentCleanupService = attachmentCleanupService;
        this.channelReadStateService = channelReadStateService;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    public static final UUID SYSTEM_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Transactional
    public Message sendMessage(UUID channelId, String content, List<AttachmentRequest> attachments, UUID authorId) {
        // getChannel already enforces membership and VIEW_CHANNEL.
        Channel channel = channelService.getChannel(channelId, authorId);

        if (channel.getType() == ChannelType.ONBOARDING) {
            throw new ForbiddenException("This channel is read-only");
        }

        permissionService.requireChannel(channel, authorId, Permission.SEND_MESSAGES);

        String trimmed = content == null ? "" : content.trim();
        List<AttachmentRequest> normalized = normalizeAttachments(attachments);

        if (!normalized.isEmpty()) {
            permissionService.requireChannel(channel, authorId, Permission.ATTACH_FILES);
        }

        if (trimmed.isEmpty() && normalized.isEmpty()) {
            throw new BadRequestException("Message must contain text or an attachment");
        }
        if (trimmed.length() > MAX_CONTENT_LENGTH) {
            throw new BadRequestException("Message content is too long");
        }

        return persistAndBroadcast(channel, authorId, trimmed, normalized);
    }

    /**
     * Drops empty entries, then validates what is left. Each URL must look exactly like one this
     * application's upload endpoint produced — the client sends the URL back over the socket, so
     * an unchecked value here would let a caller point a message at an arbitrary path.
     */
    private List<AttachmentRequest> normalizeAttachments(List<AttachmentRequest> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return List.of();
        }

        List<AttachmentRequest> normalized = new ArrayList<>();
        for (AttachmentRequest attachment : attachments) {
            if (attachment == null || attachment.url() == null || attachment.url().isBlank()) {
                continue;
            }

            String url = attachment.url().trim();
            if (!IMAGE_URL_PATTERN.matcher(url).matches()) {
                throw new BadRequestException("Invalid attachment URL");
            }
            if (attachment.fileName() != null && attachment.fileName().length() > MAX_FILE_NAME_LENGTH) {
                throw new BadRequestException("File name is too long");
            }

            normalized.add(new AttachmentRequest(url, attachment.fileName(), attachment.fileSize()));
        }

        if (normalized.size() > MAX_ATTACHMENTS) {
            throw new BadRequestException("A message can have at most " + MAX_ATTACHMENTS + " attachments");
        }

        return normalized;
    }

    /**
     * Posts a message authored by the reserved {@link #SYSTEM_USER_ID} user, bypassing the
     * membership/content checks {@link #sendMessage} enforces — this is only ever called from
     * trusted internal code (server creation / join), never reachable from user input. Used for
     * the onboarding channel's automatic join announcements.
     */
    @Transactional
    public Message postSystemMessage(UUID channelId, UUID serverId, String content) {
        // Not fetched from the repository: the caller (server creation / join) already knows both
        // ids, and this is only ever used to resolve VIEW_CHANNEL for the broadcast below, not
        // persisted.
        Channel channel = new Channel();
        channel.setId(channelId);
        channel.setServerId(serverId);
        return persistAndBroadcast(channel, SYSTEM_USER_ID, content, List.of());
    }

    private Message persistAndBroadcast(Channel channel, UUID authorId, String content,
                                         List<AttachmentRequest> attachments) {
        UUID channelId = channel.getId();
        UUID serverId = channel.getServerId();
        Message message = new Message();
        message.setChannelId(channelId);
        message.setAuthorId(authorId);
        message.setContent(content);
        Message saved = messageRepository.save(message);

        // Saved after the message so the rows have a message_id to point at. `position` comes from
        // the request's ordering, which is the order the sender arranged the previews in.
        List<MessageAttachment> savedAttachments = new ArrayList<>();
        for (int i = 0; i < attachments.size(); i++) {
            AttachmentRequest attachment = attachments.get(i);
            savedAttachments.add(messageAttachmentRepository.save(new MessageAttachment(
                    saved.getId(), attachment.url(), attachment.fileName(), attachment.fileSize(), i)));
        }

        // Only members who can actually see this channel (base permissions + channel overrides)
        // may receive the broadcast below — currentMemberIds(serverId) alone would leak private
        // channel content to the whole server.
        Set<UUID> recipients = permissionService.visibleMemberIds(channel, currentMemberIds(serverId));

        // Increment unread count for all channel members except the author
        if (!authorId.equals(SYSTEM_USER_ID)) {
            try {
                List<UUID> memberIds = recipients.stream().toList();
                channelReadStateService.incrementUnreadForChannelMembers(channelId, memberIds, authorId);
            } catch (Exception e) {
                // Log but don't fail the message send if unread tracking fails
                // This ensures message delivery is not impacted by read state tracking issues
                System.err.println("Failed to increment unread count for channel " + channelId + ": " + e.getMessage());
            }
        }

        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + authorId));

        MessageResponse payload = toResponse(saved, author, savedAttachments);
        // Deferred to AFTER_COMMIT (same pattern as ServerService.deleteServer, security audit
        // A9/Baixa follow-up): if the transaction rolls back after this point, the event is
        // simply never published, so clients never hear about a message that doesn't exist.
        applicationEventPublisher.publishEvent(new MessageCreatedEvent(recipients, payload));

        return saved;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageCreated(MessageCreatedEvent event) {
        realtimeEventPublisher.broadcast(event.recipientUserIds(), new WsEvent(WsEventType.MESSAGE_CREATE, event.payload()));
    }

    /**
     * Authorizes a GET on a previously uploaded attachment file (used by
     * {@link AttachmentServingController}, security audit A4). Same access rule as reading the
     * message it belongs to: the requester must be able to see that message's channel.
     */
    public void requireAttachmentAccess(String url, UUID requesterId) {
        MessageAttachment attachment = messageAttachmentRepository.findByUrl(url)
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found"));
        Message message = messageRepository.findById(attachment.getMessageId())
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found"));
        Channel channel = channelService.getChannel(message.getChannelId(), requesterId);
        permissionService.requireChannel(channel, requesterId, Permission.READ_MESSAGE_HISTORY);
    }

    /**
     * @param before   exclusive upper bound on {@code createdAt} for the compound cursor; {@code
     *                 null} for the first (most recent) page.
     * @param beforeId tiebreak for messages sharing {@code before}'s exact timestamp — required
     *                 whenever {@code before} is non-null (paired with the last message's id
     *                 from the previous page), since a timestamp alone cannot disambiguate
     *                 messages created in the same instant.
     */
    public List<MessageResponse> getHistory(UUID channelId, Instant before, UUID beforeId, int limit, UUID requesterId) {
        Channel channel = channelService.getChannel(channelId, requesterId);
        permissionService.requireChannel(channel, requesterId, Permission.READ_MESSAGE_HISTORY);

        if (before != null && beforeId == null) {
            throw new BadRequestException("beforeId is required when before is provided");
        }

        int effectiveLimit = limit <= 0 ? DEFAULT_HISTORY_LIMIT : Math.min(limit, MAX_HISTORY_LIMIT);
        Pageable page = PageRequest.of(0, effectiveLimit);

        List<Message> messages = before == null
                ? messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(channelId, page)
                : messageRepository.findPageBefore(channelId, before, beforeId, page);

        List<Message> chronological = new ArrayList<>(messages);
        Collections.reverse(chronological);

        List<UUID> authorIds = chronological.stream().map(Message::getAuthorId).distinct().toList();
        List<User> authors = userRepository.findAllById(authorIds);
        Map<UUID, List<MessageAttachment>> attachmentsByMessage = loadAttachments(chronological);

        return chronological.stream()
                .map(message -> {
                    User author = authors.stream()
                            .filter(u -> u.getId().equals(message.getAuthorId()))
                            .findFirst()
                            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + message.getAuthorId()));
                    return toResponse(message, author,
                            attachmentsByMessage.getOrDefault(message.getId(), List.of()));
                })
                .toList();
    }

    @Transactional
    public void deleteMessage(UUID messageId, UUID requesterId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found: " + messageId));
        Channel channel = channelService.getChannel(message.getChannelId(), requesterId);
        if (!message.getAuthorId().equals(requesterId)) {
            // Anyone else needs moderation rights in this channel.
            permissionService.requireChannel(channel, requesterId, Permission.MANAGE_MESSAGES);
        }

        // Before the delete: the message_attachments rows go with the message via ON DELETE
        // CASCADE, and the cleanup service needs them to find the files on disk.
        attachmentCleanupService.deleteForMessages(List.of(message.getId()));
        messageRepository.delete(message);
        Set<UUID> recipients = permissionService.visibleMemberIds(channel, currentMemberIds(channel.getServerId()));
        // Deferred to AFTER_COMMIT — same reasoning as persistAndBroadcast above.
        applicationEventPublisher.publishEvent(new MessageDeletedEvent(recipients,
                new MessageDeletedPayload(message.getId(), message.getChannelId())));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageDeleted(MessageDeletedEvent event) {
        realtimeEventPublisher.broadcast(event.recipientUserIds(), new WsEvent(WsEventType.MESSAGE_DELETE, event.payload()));
    }

    private Set<UUID> currentMemberIds(UUID serverId) {
        return serverMemberRepository.findByServerId(serverId).stream()
                .map(ServerMember::getUserId)
                .collect(Collectors.toSet());
    }

    /**
     * Fetches the attachments of a whole page in one query and groups them by message, so
     * rendering a 50-message page costs one attachment query rather than fifty.
     */
    private Map<UUID, List<MessageAttachment>> loadAttachments(List<Message> messages) {
        if (messages.isEmpty()) {
            return Map.of();
        }

        List<UUID> messageIds = messages.stream().map(Message::getId).toList();
        Map<UUID, List<MessageAttachment>> grouped = new LinkedHashMap<>();
        for (MessageAttachment attachment :
                messageAttachmentRepository.findByMessageIdInOrderByMessageIdAscPositionAsc(messageIds)) {
            grouped.computeIfAbsent(attachment.getMessageId(), key -> new ArrayList<>()).add(attachment);
        }
        return grouped;
    }

    private MessageResponse toResponse(Message message, User author, List<MessageAttachment> attachments) {
        UserSummaryResponse authorSummary = new UserSummaryResponse(
                author.getId(), author.getUsername(), author.getDisplayName(), UserAvatarUrls.url(author));
        List<AttachmentResponse> attachmentResponses = attachments.stream()
                .map(a -> new AttachmentResponse(a.getUrl(), a.getFileName(), a.getFileSize()))
                .toList();
        return new MessageResponse(message.getId(), message.getChannelId(), authorSummary,
                message.getContent(), attachmentResponses, message.getCreatedAt());
    }
}
