package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.messages.dto.MessageResponse;
import com.concordmvp.realtime.RealtimeEventPublisher;
import com.concordmvp.realtime.WsEvent;
import com.concordmvp.realtime.WsEventType;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private ChannelService channelService;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RealtimeEventPublisher realtimeEventPublisher;

    private MessageService messageService;

    @BeforeEach
    void setUp() {
        messageService = new MessageService(messageRepository, channelService, serverMemberRepository,
                userRepository, realtimeEventPublisher);
    }

    private Channel channel(UUID id, UUID serverId) {
        Channel channel = new Channel();
        channel.setId(id);
        channel.setServerId(serverId);
        channel.setName("general");
        channel.setType(ChannelType.TEXT);
        return channel;
    }

    private ServerMember member(UUID serverId, UUID userId) {
        ServerMember member = new ServerMember();
        member.setId(UUID.randomUUID());
        member.setServerId(serverId);
        member.setUserId(userId);
        return member;
    }

    private User user(UUID id, String username, String displayName) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setDisplayName(displayName);
        user.setEmail(username + "@example.com");
        user.setPasswordHash("hash");
        return user;
    }

    private void stubMessageSaveAssignsId() {
        when(messageRepository.save(any(Message.class))).thenAnswer(invocation -> {
            Message message = invocation.getArgument(0);
            if (message.getId() == null) {
                message.setId(UUID.randomUUID());
            }
            return message;
        });
    }

    // --- sendMessage ---

    @Test
    void sendMessage_blankContent_throwsBadRequest_andDoesNotSave() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        when(channelService.getChannel(channelId, authorId)).thenReturn(channel(channelId, serverId));

        assertThatThrownBy(() -> messageService.sendMessage(channelId, "   ", authorId))
                .isInstanceOf(BadRequestException.class);

        verify(messageRepository, never()).save(any());
        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void sendMessage_tooLongContent_throwsBadRequest_andDoesNotSave() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        when(channelService.getChannel(channelId, authorId)).thenReturn(channel(channelId, serverId));
        String tooLong = "a".repeat(4001);

        assertThatThrownBy(() -> messageService.sendMessage(channelId, tooLong, authorId))
                .isInstanceOf(BadRequestException.class);

        verify(messageRepository, never()).save(any());
        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void sendMessage_nonMember_propagatesForbiddenFromChannelService() {
        UUID channelId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        when(channelService.getChannel(channelId, authorId))
                .thenThrow(new ForbiddenException("Not a member of this server"));

        assertThatThrownBy(() -> messageService.sendMessage(channelId, "hello", authorId))
                .isInstanceOf(ForbiddenException.class);

        verify(messageRepository, never()).save(any());
        verifyNoInteractions(realtimeEventPublisher);
    }

    @Test
    void sendMessage_valid_persistsAndBroadcastsToFullServerMembership_includingSender() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        UUID otherMemberId = UUID.randomUUID();
        User author = user(authorId, "alice", "Alice");

        when(channelService.getChannel(channelId, authorId)).thenReturn(channel(channelId, serverId));
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(member(serverId, authorId), member(serverId, otherMemberId)));
        when(userRepository.findById(authorId)).thenReturn(Optional.of(author));
        stubMessageSaveAssignsId();

        Message result = messageService.sendMessage(channelId, "  hello world  ", authorId);

        assertThat(result.getContent()).isEqualTo("hello world");
        assertThat(result.getChannelId()).isEqualTo(channelId);
        assertThat(result.getAuthorId()).isEqualTo(authorId);

        ArgumentCaptor<Message> messageCaptor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(messageCaptor.capture());
        assertThat(messageCaptor.getValue().getContent()).isEqualTo("hello world");

        ArgumentCaptor<WsEvent> eventCaptor = ArgumentCaptor.forClass(WsEvent.class);
        verify(realtimeEventPublisher).broadcast(eq(Set.of(authorId, otherMemberId)), eventCaptor.capture());
        assertThat(eventCaptor.getValue().type()).isEqualTo(WsEventType.MESSAGE_CREATE);
        assertThat(eventCaptor.getValue().payload()).isInstanceOf(MessageResponse.class);

        MessageResponse payload = (MessageResponse) eventCaptor.getValue().payload();
        assertThat(payload.id()).isEqualTo(result.getId());
        assertThat(payload.channelId()).isEqualTo(channelId);
        assertThat(payload.content()).isEqualTo("hello world");
        assertThat(payload.author().id()).isEqualTo(authorId);
        assertThat(payload.author().username()).isEqualTo("alice");
        assertThat(payload.author().displayName()).isEqualTo("Alice");
    }

    // --- getHistory ---

    @Test
    void getHistory_nonMember_propagatesForbiddenFromChannelService() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ForbiddenException("Not a member of this server"));

        assertThatThrownBy(() -> messageService.getHistory(channelId, null, null, 50, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void getHistory_returnsChronologicalOrder_despiteRepositoryReturningNewestFirst() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));
        when(userRepository.findAllById(any())).thenReturn(List.of(user(authorId, "bob", "Bob")));

        Instant now = Instant.now();
        Message newest = newMessage(channelId, authorId, "newest", now);
        Message middle = newMessage(channelId, authorId, "middle", now.minus(1, ChronoUnit.MINUTES));
        Message oldest = newMessage(channelId, authorId, "oldest", now.minus(2, ChronoUnit.MINUTES));
        // Repository is stubbed to return newest-first, mirroring the real query ordering.
        when(messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), any()))
                .thenReturn(List.of(newest, middle, oldest));

        List<MessageResponse> result = messageService.getHistory(channelId, null, null, 50, requesterId);

        assertThat(result).extracting(MessageResponse::content)
                .containsExactly("oldest", "middle", "newest");
    }

    @Test
    void getHistory_beforeCursor_usesCompoundCursorQuery() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Instant before = Instant.now();
        UUID beforeId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));
        when(messageRepository.findPageBefore(eq(channelId), eq(before), eq(beforeId), any()))
                .thenReturn(List.of());

        List<MessageResponse> result = messageService.getHistory(channelId, before, beforeId, 50, requesterId);

        assertThat(result).isEmpty();
        verify(messageRepository, never()).findByChannelIdOrderByCreatedAtDescIdDesc(any(), any());
    }

    @Test
    void getHistory_beforeWithoutBeforeId_throwsBadRequest() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));

        assertThatThrownBy(() -> messageService.getHistory(channelId, Instant.now(), null, 50, requesterId))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(messageRepository);
    }

    /**
     * Locks the fix for the pagination-skip bug: filtering older pages on {@code createdAt <
     * before} alone silently drops messages that share the exact same {@code createdAt} as the
     * cursor whenever they land on the wrong side of a page split (verified against a real
     * Postgres instance during code review). The compound {@code (before, beforeId)} cursor,
     * translated by {@code findPageBefore}'s JPQL into {@code createdAt < :before OR (createdAt =
     * :before AND id < :beforeId)}, must receive both pieces so no message sharing the boundary
     * timestamp is skipped or duplicated across the two pages.
     */
    @Test
    void getHistory_paginatesAcrossSameTimestampBoundary_noSkipOrDuplicate() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));
        when(userRepository.findAllById(any())).thenReturn(List.of(user(authorId, "bob", "Bob")));

        Instant boundary = Instant.now();
        // Three messages share the exact same createdAt; ids are used to order/split them.
        UUID idA = UUID.fromString("00000000-0000-0000-0000-00000000000a"); // newest of the three
        UUID idB = UUID.fromString("00000000-0000-0000-0000-000000000009"); // last item of page 1
        UUID idC = UUID.fromString("00000000-0000-0000-0000-000000000008"); // must surface on page 2

        Message a = newMessage(channelId, authorId, "a", boundary, idA);
        Message b = newMessage(channelId, authorId, "b", boundary, idB);
        Message c = newMessage(channelId, authorId, "c", boundary, idC);

        // Page 1: newest-first, page size 2 -> [a, b]. b is the last item, so it becomes the
        // cursor (before=boundary, beforeId=idB) for page 2.
        when(messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), any()))
                .thenReturn(List.of(a, b));
        // Page 2 must use the compound cursor (createdAt = boundary AND id < idB) to surface c —
        // a plain "createdAt < boundary" filter would incorrectly skip it.
        when(messageRepository.findPageBefore(eq(channelId), eq(boundary), eq(idB), any()))
                .thenReturn(List.of(c));

        List<MessageResponse> page1 = messageService.getHistory(channelId, null, null, 2, requesterId);
        List<MessageResponse> page2 = messageService.getHistory(channelId, boundary, idB, 2, requesterId);

        assertThat(page1).extracting(MessageResponse::content).containsExactly("b", "a");
        assertThat(page2).extracting(MessageResponse::content).containsExactly("c");

        // No overlap and nothing missing across the two pages.
        List<UUID> allIds = new ArrayList<>();
        page1.forEach(m -> allIds.add(m.id()));
        page2.forEach(m -> allIds.add(m.id()));
        assertThat(allIds).containsExactlyInAnyOrder(idA, idB, idC);
    }

    @Test
    void getHistory_limitAboveMax_clampedTo100() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));
        when(messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), any()))
                .thenReturn(List.of());

        messageService.getHistory(channelId, null, null, 1000, requesterId);

        ArgumentCaptor<org.springframework.data.domain.Pageable> pageableCaptor =
                ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(messageRepository).findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(100);
    }

    @Test
    void getHistory_nonPositiveLimit_defaultsTo50() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));
        when(messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), any()))
                .thenReturn(List.of());

        messageService.getHistory(channelId, null, null, 0, requesterId);

        ArgumentCaptor<org.springframework.data.domain.Pageable> pageableCaptor =
                ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(messageRepository).findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(50);
    }

    private Message newMessage(UUID channelId, UUID authorId, String content, Instant createdAt) {
        return newMessage(channelId, authorId, content, createdAt, UUID.randomUUID());
    }

    private Message newMessage(UUID channelId, UUID authorId, String content, Instant createdAt, UUID id) {
        Message message = new Message();
        message.setId(id);
        message.setChannelId(channelId);
        message.setAuthorId(authorId);
        message.setContent(content);
        // createdAt/updatedAt are normally set by @PrePersist; set directly here since this
        // Message is never actually persisted.
        setCreatedAt(message, createdAt);
        return message;
    }

    private void setCreatedAt(Message message, Instant createdAt) {
        try {
            var field = Message.class.getDeclaredField("createdAt");
            field.setAccessible(true);
            field.set(message, createdAt);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }
}
