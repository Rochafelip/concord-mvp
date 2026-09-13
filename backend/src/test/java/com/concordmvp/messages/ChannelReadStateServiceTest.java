package com.concordmvp.messages;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelRepository;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannelReadStateServiceTest {

    @Mock
    private ChannelReadStateRepository channelReadStateRepository;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private ChannelRepository channelRepository;

    @Mock
    private MessageRepository messageRepository;

    @InjectMocks
    private ChannelReadStateService channelReadStateService;

    private UUID userId;
    private UUID channelId;
    private UUID serverId;
    private ChannelReadState readState;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        channelId = UUID.randomUUID();
        serverId = UUID.randomUUID();

        readState = new ChannelReadState();
        readState.setId(UUID.randomUUID());
        readState.setUserId(userId);
        readState.setChannelId(channelId);
        readState.setUnreadCount(0);
        readState.setLastReadAt(Instant.now());
    }

    @Test
    void initializeReadState_whenStateDoesNotExist_createsNewState() {
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.empty());
        when(channelReadStateRepository.save(any(ChannelReadState.class)))
                .thenReturn(readState);

        ChannelReadState result = channelReadStateService.initializeReadState(userId, channelId);

        assertThat(result).isNotNull();
        assertThat(result.getUserId()).isEqualTo(userId);
        assertThat(result.getChannelId()).isEqualTo(channelId);
        assertThat(result.getUnreadCount()).isEqualTo(0);

        verify(channelReadStateRepository).save(any(ChannelReadState.class));
    }

    @Test
    void initializeReadState_whenStateExists_returnsExistingState() {
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));

        ChannelReadState result = channelReadStateService.initializeReadState(userId, channelId);

        assertThat(result).isSameAs(readState);
        verify(channelReadStateRepository, never()).save(any(ChannelReadState.class));
    }

    @Test
    void incrementUnreadForChannelMembers_incrementsForAllMembersExceptAuthor() {
        UUID authorId = UUID.randomUUID();
        UUID member1Id = UUID.randomUUID();
        UUID member2Id = UUID.randomUUID();

        ServerMember author = createServerMember(authorId);
        ServerMember member1 = createServerMember(member1Id);
        ServerMember member2 = createServerMember(member2Id);

        when(channelRepository.findById(channelId))
                .thenReturn(Optional.of(createChannel(serverId)));
        when(serverMemberRepository.findByServerId(serverId))
                .thenReturn(List.of(author, member1, member2));
        when(channelReadStateRepository.findByUserIdAndChannelId(any(UUID), eq(channelId)))
                .thenReturn(Optional.empty());
        when(channelReadStateRepository.save(any(ChannelReadState.class)))
                .thenReturn(readState);
        when(channelReadStateRepository.incrementUnreadCount(any(UUID), eq(channelId)))
                .thenReturn(1);

        channelReadStateService.incrementUnreadForChannelMembers(channelId, authorId);

        // Should increment for member1 and member2, but not for author
        verify(channelReadStateRepository).incrementUnreadCount(member1Id, channelId);
        verify(channelReadStateRepository).incrementUnreadCount(member2Id, channelId);
        verify(channelReadStateRepository, never()).incrementUnreadCount(authorId, channelId);
    }

    @Test
    void markChannelAsRead_marksChannelAsReadWithMessageId() {
        UUID messageId = UUID.randomUUID();
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));
        when(channelReadStateRepository.markAsRead(eq(userId), eq(channelId), eq(messageId), any(Instant.class)))
                .thenReturn(1);
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));

        ChannelReadState result = channelReadStateService.markChannelAsRead(userId, channelId, messageId);

        assertThat(result).isNotNull();
        verify(channelReadStateRepository).markAsRead(eq(userId), eq(channelId), eq(messageId), any(Instant.class));
    }

    @Test
    void markChannelAsRead_whenStateDoesNotExist_initializesFirst() {
        UUID messageId = UUID.randomUUID();
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(readState));
        when(channelReadStateRepository.save(any(ChannelReadState.class)))
                .thenReturn(readState);
        when(channelReadStateRepository.markAsRead(eq(userId), eq(channelId), eq(messageId), any(Instant.class)))
                .thenReturn(1);

        ChannelReadState result = channelReadStateService.markChannelAsRead(userId, channelId, messageId);

        assertThat(result).isNotNull();
        verify(channelReadStateRepository).save(any(ChannelReadState.class));
        verify(channelReadStateRepository).markAsRead(eq(userId), eq(channelId), eq(messageId), any(Instant.class));
    }

    @Test
    void markChannelAsReadWithoutMessage_marksChannelAsReadWithoutMessageId() {
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));
        when(channelReadStateRepository.markAsReadWithoutMessage(eq(userId), eq(channelId), any(Instant.class)))
                .thenReturn(1);
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));

        ChannelReadState result = channelReadStateService.markChannelAsReadWithoutMessage(userId, channelId);

        assertThat(result).isNotNull();
        verify(channelReadStateRepository).markAsReadWithoutMessage(eq(userId), eq(channelId), any(Instant.class));
    }

    @Test
    void getReadState_returnsStateWhenExists() {
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));

        Optional<ChannelReadState> result = channelReadStateService.getReadState(userId, channelId);

        assertThat(result).isPresent();
        assertThat(result.get()).isSameAs(readState);
    }

    @Test
    void getReadState_returnsEmptyWhenNotExists() {
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.empty());

        Optional<ChannelReadState> result = channelReadStateService.getReadState(userId, channelId);

        assertThat(result).isEmpty();
    }

    @Test
    void getUserReadStates_returnsAllStatesForUser() {
        List<ChannelReadState> states = List.of(readState);
        when(channelReadStateRepository.findByUserId(userId))
                .thenReturn(states);

        List<ChannelReadState> result = channelReadStateService.getUserReadStates(userId);

        assertThat(result).isSameAs(states);
    }

    @Test
    void getUnreadCount_returnsCountWhenStateExists() {
        readState.setUnreadCount(5);
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));

        Integer result = channelReadStateService.getUnreadCount(userId, channelId);

        assertThat(result).isEqualTo(5);
    }

    @Test
    void getUnreadCount_returnsZeroWhenStateDoesNotExist() {
        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.empty());

        Integer result = channelReadStateService.getUnreadCount(userId, channelId);

        assertThat(result).isEqualTo(0);
    }

    @Test
    void recalculateUnreadCount_recalculatesFromMessages() {
        readState.setUnreadCount(10);
        Instant timestamp = Instant.now();
        readState.setLastReadAt(timestamp);

        when(channelReadStateRepository.findByUserIdAndChannelId(userId, channelId))
                .thenReturn(Optional.of(readState));
        when(messageRepository.countByChannelIdAndCreatedAtAfter(channelId, timestamp))
                .thenReturn(7L);
        when(channelReadStateRepository.save(any(ChannelReadState.class)))
                .thenReturn(readState);

        channelReadStateService.recalculateUnreadCount(userId, channelId);

        assertThat(readState.getUnreadCount()).isEqualTo(7);
        verify(channelReadStateRepository).save(readState);
    }

    @Test
    void initializeReadStatesForServer_initializesForAllChannels() {
        UUID serverId = UUID.randomUUID();
        Channel channel1 = createChannel(serverId);
        Channel channel2 = createChannel(serverId);
        channel1.setId(UUID.randomUUID());
        channel2.setId(UUID.randomUUID());

        when(channelRepository.findByServerId(serverId))
                .thenReturn(List.of(channel1, channel2));
        when(channelReadStateRepository.findByUserIdAndChannelId(any(UUID), any(UUID)))
                .thenReturn(Optional.empty());
        when(channelReadStateRepository.save(any(ChannelReadState.class)))
                .thenReturn(readState);

        channelReadStateService.initializeReadStatesForServer(userId, serverId);

        verify(channelReadStateRepository, times(2)).save(any(ChannelReadState.class));
    }

    private ServerMember createServerMember(UUID userId) {
        ServerMember member = new ServerMember();
        member.setUserId(userId);
        member.setServerId(serverId);
        return member;
    }

    private Channel createChannel(UUID serverId) {
        Channel channel = new Channel();
        channel.setId(channelId);
        channel.setServerId(serverId);
        channel.setName("test-channel");
        return channel;
    }
}
