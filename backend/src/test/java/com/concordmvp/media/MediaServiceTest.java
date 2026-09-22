package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ForbiddenException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.media.dto.VoiceTokenResponse;
import com.concordmvp.permissions.Permission;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.permissions.PermissionSet;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class MediaServiceTest {

    private static final String API_KEY = "test-api-key";
    private static final String API_SECRET = "test-api-secret-at-least-32-bytes-long";
    private static final String PUBLIC_URL = "wss://example.test/livekit";
    private static final String SERVER_URL = "http://livekit.internal:7880";

    @Mock
    private ChannelService channelService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ServerMemberRepository serverMemberRepository;

    @Mock
    private PermissionService permissionService;

    private MediaService mediaService;
    private MockRestServiceServer mockLivekitServer;

    @BeforeEach
    void setUp() {
        RestClient.Builder restClientBuilder = RestClient.builder();
        mockLivekitServer = MockRestServiceServer.bindTo(restClientBuilder).build();
        mediaService = new MediaService(channelService, userRepository, API_KEY, API_SECRET, PUBLIC_URL, SERVER_URL,
                serverMemberRepository, permissionService, restClientBuilder);
    }

    /**
     * Makes the requester a member (needed for the per-server nickname lookup) and grants it the
     * given voice permissions in the channel under test.
     */
    private void voicePermissions(UUID channelId, UUID requesterId, Permission... permissions) {
        ServerMember membership = new ServerMember();
        membership.setId(UUID.randomUUID());
        membership.setUserId(requesterId);
        when(serverMemberRepository.findByServerIdAndUserId(any(), eq(requesterId)))
                .thenReturn(Optional.of(membership));
        when(permissionService.channelPermissions(any(Channel.class), eq(requesterId)))
                .thenReturn(PermissionSet.toBitmask(Set.of(permissions)));
    }

    @SuppressWarnings("unchecked")
    private static List<String> publishSources(Claims claims) {
        Map<String, Object> video = claims.get("video", Map.class);
        return (List<String>) video.get("canPublishSources");
    }

    private static Claims parse(String token) {
        SecretKey key = Keys.hmacShaKeyFor(API_SECRET.getBytes(StandardCharsets.UTF_8));
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
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
        user.setEmailVerified(true);
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
        voicePermissions(channelId, requesterId, Permission.CONNECT, Permission.SPEAK,
                Permission.USE_VIDEO, Permission.SHARE_SCREEN);

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

    // --- voice permissions are enforced by the LiveKit grant itself ---

    @Test
    void issueVoiceToken_withoutConnect_throwsForbidden_andMintsNoToken() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, requesterId)).thenReturn(voice);
        doThrow(new ForbiddenException("denied")).when(permissionService)
                .requireChannel(voice, requesterId, Permission.CONNECT);

        assertThatThrownBy(() -> mediaService.issueVoiceToken(channelId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void issueVoiceToken_allVoicePermissions_grantsEveryPublishSource() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, UUID.randomUUID(), ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(user(requesterId, "Felipe R")));
        voicePermissions(channelId, requesterId, Permission.CONNECT, Permission.SPEAK,
                Permission.USE_VIDEO, Permission.SHARE_SCREEN);

        Claims claims = parse(mediaService.issueVoiceToken(channelId, requesterId).token());

        assertThat(publishSources(claims))
                .containsExactlyInAnyOrder("microphone", "camera", "screen_share", "screen_share_audio");
    }

    @Test
    void issueVoiceToken_withoutShareScreen_omitsTheScreenShareSourceSoLiveKitRefusesIt() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, UUID.randomUUID(), ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(user(requesterId, "Felipe R")));
        voicePermissions(channelId, requesterId, Permission.CONNECT, Permission.SPEAK, Permission.USE_VIDEO);

        Claims claims = parse(mediaService.issueVoiceToken(channelId, requesterId).token());

        assertThat(publishSources(claims)).containsExactlyInAnyOrder("microphone", "camera");
    }

    @Test
    void issueVoiceToken_withoutSpeak_omitsTheMicrophoneSource() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, UUID.randomUUID(), ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(user(requesterId, "Felipe R")));
        voicePermissions(channelId, requesterId, Permission.CONNECT, Permission.USE_VIDEO);

        Claims claims = parse(mediaService.issueVoiceToken(channelId, requesterId).token());

        assertThat(publishSources(claims)).containsExactly("camera");
    }

    // --- preview token: hover preview joins hidden and read-only, never publishes ---

    @Test
    void issuePreviewToken_channelNotFound_throwsResourceNotFound() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenThrow(new ResourceNotFoundException("Channel not found: " + channelId));

        assertThatThrownBy(() -> mediaService.issuePreviewToken(channelId, requesterId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void issuePreviewToken_channelIsTextType_throwsBadRequest() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.TEXT));

        assertThatThrownBy(() -> mediaService.issuePreviewToken(channelId, requesterId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void issuePreviewToken_withoutConnect_throwsForbidden() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        Channel voice = channel(channelId, serverId, ChannelType.VOICE);
        when(channelService.getChannel(channelId, requesterId)).thenReturn(voice);
        doThrow(new ForbiddenException("denied")).when(permissionService)
                .requireChannel(voice, requesterId, Permission.CONNECT);

        assertThatThrownBy(() -> mediaService.issuePreviewToken(channelId, requesterId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void issuePreviewToken_userNotFound_throwsResourceNotFound() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mediaService.issuePreviewToken(channelId, requesterId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void issuePreviewToken_grantsHiddenSubscribeOnlyTokenWithNoPublishSources() {
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(user(requesterId, "Felipe R")));

        VoiceTokenResponse response = mediaService.issuePreviewToken(channelId, requesterId);

        String expectedRoomName = "voice-channel-" + channelId;
        assertThat(response.roomName()).isEqualTo(expectedRoomName);
        assertThat(response.url()).isEqualTo(PUBLIC_URL);

        Claims claims = parse(response.token());
        assertThat(claims.getSubject()).isEqualTo(requesterId.toString());

        @SuppressWarnings("unchecked")
        Map<String, Object> video = claims.get("video", Map.class);
        assertThat(video.get("room")).isEqualTo(expectedRoomName);
        assertThat(video.get("roomJoin")).isEqualTo(true);
        assertThat(video.get("canPublish")).isEqualTo(false);
        assertThat(video.get("canSubscribe")).isEqualTo(true);
        assertThat(video.get("hidden")).isEqualTo(true);
        assertThat(publishSources(claims)).isEmpty();
    }

    @Test
    void issuePreviewToken_grantsAreIndependentOfTheRequestersActualVoicePermissions() {
        // Even a member with full mic/camera/screen-share permissions gets a publish-nothing,
        // hidden preview token — this endpoint is view-only by construction, not by omission.
        UUID serverId = UUID.randomUUID();
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, serverId, ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(user(requesterId, "Felipe R")));

        Claims claims = parse(mediaService.issuePreviewToken(channelId, requesterId).token());

        assertThat(publishSources(claims)).isEmpty();
        @SuppressWarnings("unchecked")
        Map<String, Object> video = claims.get("video", Map.class);
        assertThat(video.get("canPublish")).isEqualTo(false);
    }

    @Test
    void issueVoiceToken_listenerOnly_canJoinAndSubscribeButNotPublishAnything() {
        UUID channelId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();
        when(channelService.getChannel(channelId, requesterId))
                .thenReturn(channel(channelId, UUID.randomUUID(), ChannelType.VOICE));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(user(requesterId, "Felipe R")));
        voicePermissions(channelId, requesterId, Permission.CONNECT);

        Claims claims = parse(mediaService.issueVoiceToken(channelId, requesterId).token());

        @SuppressWarnings("unchecked")
        Map<String, Object> video = claims.get("video", Map.class);
        assertThat(video.get("canPublish")).isEqualTo(false);
        assertThat(video.get("roomJoin")).isEqualTo(true);
        assertThat(video.get("canSubscribe")).isEqualTo(true);
        assertThat(publishSources(claims)).isEmpty();
    }

    // --- removeParticipant ---

    @Test
    void removeParticipant_sendsRemoveParticipantRequestToLiveKitServerApi() {
        UUID channelId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        String roomName = "voice-channel-" + channelId;

        mockLivekitServer.expect(requestTo(SERVER_URL + "/twirp/livekit.RoomService/RemoveParticipant"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", Matchers.startsWith("Bearer ")))
                .andExpect(jsonPath("$.room").value(roomName))
                .andExpect(jsonPath("$.identity").value(userId.toString()))
                .andRespond(withSuccess());

        mediaService.removeParticipant(channelId, userId);

        mockLivekitServer.verify();
    }

    @Test
    void removeParticipant_sendsAnAdminTokenScopedToTheRoom() {
        UUID channelId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        String roomName = "voice-channel-" + channelId;
        String[] capturedAuthorization = new String[1];

        mockLivekitServer.expect(requestTo(SERVER_URL + "/twirp/livekit.RoomService/RemoveParticipant"))
                .andExpect(request -> capturedAuthorization[0] = request.getHeaders().getFirst("Authorization"))
                .andRespond(withSuccess());

        mediaService.removeParticipant(channelId, userId);

        String token = capturedAuthorization[0].substring("Bearer ".length());
        Claims claims = parse(token);
        @SuppressWarnings("unchecked")
        Map<String, Object> video = claims.get("video", Map.class);
        assertThat(video.get("roomAdmin")).isEqualTo(true);
        assertThat(video.get("room")).isEqualTo(roomName);
    }

    @Test
    void removeParticipant_livekitUnreachableOrErrors_doesNotThrow() {
        UUID channelId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        mockLivekitServer.expect(requestTo(SERVER_URL + "/twirp/livekit.RoomService/RemoveParticipant"))
                .andRespond(withServerError());

        assertThatCode(() -> mediaService.removeParticipant(channelId, userId)).doesNotThrowAnyException();
    }
}
