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

        assertThatThrownBy(() -> messageService.getHistory(channelId, null, 50, requesterId))
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

        List<MessageResponse> result = messageService.getHistory(channelId, null, 50, requesterId);

        assertThat(result).extracting(MessageResponse::content)
                .containsExactly("oldest", "middle", "newest");
    }

    @Test
    void getHistory_beforeCursor_usesCreatedAtBeforeQuery() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Instant before = Instant.now();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));
        when(messageRepository.findByChannelIdAndCreatedAtBeforeOrderByCreatedAtDescIdDesc(eq(channelId), eq(before), any()))
                .thenReturn(List.of());

        List<MessageResponse> result = messageService.getHistory(channelId, before, 50, requesterId);

        assertThat(result).isEmpty();
        verify(messageRepository, never()).findByChannelIdOrderByCreatedAtDescIdDesc(any(), any());
    }

    @Test
    void getHistory_limitAboveMax_clampedTo100() {
        UUID channelId = UUID.randomUUID();
        UUID serverId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId)).thenReturn(channel(channelId, serverId));
        when(messageRepository.findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), any()))
                .thenReturn(List.of());

        messageService.getHistory(channelId, null, 1000, requesterId);

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

        messageService.getHistory(channelId, null, 0, requesterId);

        ArgumentCaptor<org.springframework.data.domain.Pageable> pageableCaptor =
                ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(messageRepository).findByChannelIdOrderByCreatedAtDescIdDesc(eq(channelId), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(50);
    }

    private Message newMessage(UUID channelId, UUID authorId, String content, Instant createdAt) {
        Message message = new Message();
        message.setId(UUID.randomUUID());
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
