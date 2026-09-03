package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.media.dto.VoiceTokenResponse;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaServiceTest {

    private static final String API_KEY = "test-api-key";
    private static final String API_SECRET = "test-api-secret-at-least-32-bytes-long";
    private static final String PUBLIC_URL = "wss://example.test/livekit";

    @Mock
    private ChannelService channelService;

    @Mock
    private UserRepository userRepository;

    private MediaService mediaService;

    @BeforeEach
    void setUp() {
        mediaService = new MediaService(channelService, userRepository, API_KEY, API_SECRET, PUBLIC_URL);
    }

    private Channel channel(UUID id, UUID serverId, ChannelType type) {
        Channel channel = new Channel();
        channel.setId(id);
        channel.setServerId(serverId);
        channel.setName("general");
        channel.setType(type);
        return channel;
    }

    private User user(UUID id, String displayName) {
        User user = new User();
        user.setId(id);
        user.setUsername("someuser");
        user.setDisplayName(displayName);
        user.setEmail("someuser@example.test");
        return user;
    }

    @Test
    void issueVoiceToken_channelNotFound_throwsResourceNotFound() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ResourceNotFoundException("Channel not found: " + channelId));

        assertThatThrownBy(() -> mediaService.issueVoiceToken(channelId, requesterId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void issueVoiceToken_nonMember_throwsForbidden() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ForbiddenException("Not a member of this server"));

        assertThatThrownBy(() -> mediaService.issueVoiceToken(channelId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void issueVoiceToken_channelIsTextType_throwsBadRequest() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.TEXT));

        assertThatThrownBy(() -> mediaService.issueVoiceToken(channelId, requesterId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void issueVoiceToken_userNotFound_throwsResourceNotFound() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mediaService.issueVoiceToken(channelId, requesterId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void issueVoiceToken_voiceChannel_member_returnsTokenWithExpectedGrantsAndRoomName() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(user(requesterId, "Felipe R")));

        VoiceTokenResponse response = mediaService.issueVoiceToken(channelId, requesterId);

        String expectedRoomName = "voice-channel-" + channelId;
        assertThat(response.roomName()).isEqualTo(expectedRoomName);
        assertThat(response.url()).isEqualTo(PUBLIC_URL);
        assertThat(response.token()).isNotBlank();

        SecretKey key = Keys.hmacShaKeyFor(API_SECRET.getBytes(StandardCharsets.UTF_8));
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(response.token()).getPayload();

        assertThat(claims.getIssuer()).isEqualTo(API_KEY);
        assertThat(claims.getSubject()).isEqualTo(requesterId.toString());
        assertThat(claims.get("name", String.class)).isEqualTo("Felipe R");

        @SuppressWarnings("unchecked")
        Map<String, Object> video = claims.get("video", Map.class);
        assertThat(video.get("room")).isEqualTo(expectedRoomName);
        assertThat(video.get("roomJoin")).isEqualTo(true);
        assertThat(video.get("canPublish")).isEqualTo(true);
        assertThat(video.get("canSubscribe")).isEqualTo(true);
    }
}
