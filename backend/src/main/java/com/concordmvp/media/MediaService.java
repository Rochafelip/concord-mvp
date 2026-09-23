package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.media.dto.VoiceTokenResponse;
import com.concordmvp.permissions.Permission;
import com.concordmvp.permissions.PermissionService;
import com.concordmvp.permissions.PermissionSet;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import com.concordmvp.servers.ServerMember;
import com.concordmvp.servers.ServerMemberRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Issues LiveKit access tokens authorizing a member to join a voice channel's room. Reuses
 * {@link ChannelService#getChannel(UUID, UUID)} for the "channel exists (404) + requester is a
 * member of its server (403)" check, same as {@code messages.MessageService}, rather than
 * re-deriving it from raw repositories.
 *
 * <p>Deliberately hand-rolls the LiveKit JWT with the project's existing {@code jjwt} dependency
 * instead of adding {@code io.livekit:livekit-server}: that SDK's only relevant class for this
 * use case is a thin wrapper around exactly this JWT shape (confirmed by reading its source),
 * but it pulls in Retrofit, protobuf-java and kotlin-stdlib transitively — dependencies this
 * module has no other use for. Minting is a pure local JWT signing operation (no network call to
 * LiveKit), so reusing {@code jjwt} keeps the dependency footprint unchanged (docs/TECH_STACK.md
 * §30/§34). The claim shape (issuer/subject/exp/name/video grant map) mirrors LiveKit's own
 * {@code AccessToken.toJwt()} exactly.
 *
 * <p>The grant is where voice permissions are actually enforced. SPEAK, USE_VIDEO and SHARE_SCREEN
 * become entries in {@code canPublishSources}, so LiveKit itself refuses a track the user may not
 * publish — a tampered client cannot talk its way past it. Because the grant is fixed when the
 * token is minted, a permission change during a call is applied by having the client rejoin
 * (docs/DECISIONS.md D20).
 *
 * <p>{@link #removeParticipant} is the one operation that does call LiveKit's Server API
 * (security audit A5) — the join token above stays valid for {@link #TOKEN_TTL} regardless of
 * server membership, so ending a call early needs an explicit disconnect, not just letting the
 * token expire.
 */
@Service
public class MediaService {

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    private static final Duration TOKEN_TTL = Duration.ofHours(6);
    private static final Duration ADMIN_TOKEN_TTL = Duration.ofSeconds(30);

    private final ChannelService channelService;
    private final UserRepository userRepository;
    private final ServerMemberRepository serverMemberRepository;
    private final PermissionService permissionService;
    private final String livekitApiKey;
    private final SecretKey livekitSigningKey;
    private final String livekitPublicUrl;
    private final RestClient livekitServerClient;

    @Autowired
    public MediaService(ChannelService channelService,
                         UserRepository userRepository,
                         @Value("${livekit.api-key}") String livekitApiKey,
                         @Value("${livekit.api-secret}") String livekitApiSecret,
                         @Value("${livekit.public-url}") String livekitPublicUrl,
                         @Value("${livekit.server-url}") String livekitServerUrl,
                         ServerMemberRepository serverMemberRepository,
                         PermissionService permissionService,
                         RestClient.Builder restClientBuilder) {
        this.permissionService = permissionService;
        this.channelService = channelService;
        this.userRepository = userRepository;
        this.serverMemberRepository = serverMemberRepository;
        this.livekitApiKey = livekitApiKey;
        this.livekitSigningKey = Keys.hmacShaKeyFor(livekitApiSecret.getBytes(StandardCharsets.UTF_8));
        this.livekitServerClient = restClientBuilder.baseUrl(livekitServerUrl).build();
        this.livekitPublicUrl = livekitPublicUrl;
    }

    /** Every publish source there is — a 1:1 call has no roles to derive rights from, so once
     *  accepted, both sides always get full mic/camera/screen-share rights. */
    private static final List<String> DM_CALL_PUBLISH_SOURCES =
            List.of("microphone", "camera", "screen_share", "screen_share_audio");

    /**
     * Issues a token for a 1:1 call between two friends
     * (docs/superpowers/specs/2026-09-23-dm-call-design.md). Unlike {@link #issueVoiceToken},
     * there's no channel/role to derive publish rights from — access is gated upstream by
     * {@code dmcalls.DmCallService} (friendship + the call having actually been accepted), not by
     * a grant computed here.
     */
    public VoiceTokenResponse issueDmCallToken(UUID requesterId, String roomName) {
        User requester = requireVerifiedUser(requesterId);
        String token = buildLiveKitToken(requester, requester.getDisplayName(), roomName,
                DM_CALL_PUBLISH_SOURCES, false);
        return new VoiceTokenResponse(token, livekitPublicUrl, roomName);
    }

    public VoiceTokenResponse issueVoiceToken(UUID channelId, UUID requesterId) {
        Channel channel = validateVoiceChannel(channelId, requesterId);
        User requester = requireVerifiedUser(requesterId);

        String roomName = "voice-channel-" + channel.getId();
        // Membership was already enforced by getChannel above; this lookup is for the per-server
        // nickname, and doubles as a safety net if that ever stops being true.
        ServerMember membership = serverMemberRepository.findByServerIdAndUserId(
                        channel.getServerId(), requesterId)
                .orElseThrow(() -> new com.concordmvp.common.exception.ForbiddenException(
                        "Not a member of this server: " + channel.getServerId()));
        String displayName = membership.getDisplayName() == null
                ? requester.getDisplayName() : membership.getDisplayName();
        long permissions = permissionService.channelPermissions(channel, requesterId);
        String token = buildLiveKitToken(requester, displayName, roomName, publishSourcesFor(permissions), false);

        return new VoiceTokenResponse(token, livekitPublicUrl, roomName);
    }

    /**
     * Issues a token for the sidebar's screen-share hover preview: joins the same LiveKit room as
     * the real call, but read-only and {@code hidden} — LiveKit excludes a hidden
     * participant from every other participant's roster, so a hovering viewer never appears in
     * anyone's participant list, never triggers a join sound, and is never counted as "in the
     * call." Publish sources are always empty regardless of the requester's actual voice
     * permissions: this endpoint is view-only by construction, not by omission of a grant that
     * happens to be absent.
     */
    public VoiceTokenResponse issuePreviewToken(UUID channelId, UUID requesterId) {
        Channel channel = validateVoiceChannel(channelId, requesterId);
        User requester = requireVerifiedUser(requesterId);

        String roomName = "voice-channel-" + channel.getId();
        String token = buildLiveKitToken(requester, requester.getDisplayName(), roomName, List.of(), true);

        return new VoiceTokenResponse(token, livekitPublicUrl, roomName);
    }

    /**
     * Forcibly disconnects a participant from a voice channel's LiveKit room via the Server API
     * (security audit A5), called by {@link com.concordmvp.media.VoicePresenceService#disconnectFromServer}
     * when server membership ends. Best-effort: a participant who already disconnected, an
     * unknown room, or LiveKit being briefly unreachable must never block whatever caller
     * triggered this (e.g. leaving a server).
     */
    public void removeParticipant(UUID channelId, UUID userId) {
        String roomName = "voice-channel-" + channelId;
        try {
            livekitServerClient.post()
                    .uri("/twirp/livekit.RoomService/RemoveParticipant")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + buildRoomAdminToken(roomName))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("room", roomName, "identity", userId.toString()))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException ex) {
            log.warn("Failed to remove participant {} from LiveKit room {}", userId, roomName, ex);
        }
    }

    private String buildRoomAdminToken(String roomName) {
        Instant now = Instant.now();
        Map<String, Object> videoGrant = new LinkedHashMap<>();
        videoGrant.put("roomAdmin", true);
        videoGrant.put("room", roomName);

        return Jwts.builder()
                .issuer(livekitApiKey)
                .expiration(Date.from(now.plus(ADMIN_TOKEN_TTL)))
                .claim("video", videoGrant)
                .signWith(livekitSigningKey)
                .compact();
    }

    private Channel validateVoiceChannel(UUID channelId, UUID requesterId) {
        Channel channel = channelService.getChannel(channelId, requesterId);

        if (channel.getType() != ChannelType.VOICE) {
            throw new BadRequestException("Channel is not a voice channel: " + channelId);
        }

        permissionService.requireChannel(channel, requesterId, Permission.CONNECT);
        return channel;
    }

    private User requireVerifiedUser(UUID requesterId) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + requesterId));
        if (!requester.isEmailVerified()) {
            throw new com.concordmvp.common.exception.ForbiddenException(
                    "Verifique seu e-mail antes de entrar no chat de voz.");
        }
        return requester;
    }

    private String buildLiveKitToken(User requester, String displayName, String roomName,
                                      List<String> publishSources, boolean hidden) {
        Instant now = Instant.now();

        // LinkedHashMap rather than Map.of: the source order must be stable for the claim to be
        // reproducible, and Map.of neither preserves order nor takes a variable number of pairs.
        Map<String, Object> videoGrant = new LinkedHashMap<>();
        videoGrant.put("roomJoin", true);
        videoGrant.put("room", roomName);
        videoGrant.put("canPublish", !publishSources.isEmpty());
        videoGrant.put("canPublishSources", publishSources);
        videoGrant.put("canSubscribe", true);
        videoGrant.put("hidden", hidden);

        return Jwts.builder()
                .issuer(livekitApiKey)
                .subject(requester.getId().toString())
                .expiration(Date.from(now.plus(TOKEN_TTL)))
                .claim("name", displayName)
                .claim("video", videoGrant)
                .signWith(livekitSigningKey)
                .compact();
    }

    /**
     * Maps the user's voice permissions onto LiveKit's track sources. An empty list means
     * listen-only: the member can join and hear, but LiveKit will reject any track it publishes.
     */
    private static List<String> publishSourcesFor(long permissions) {
        List<String> sources = new ArrayList<>();
        if (PermissionSet.has(permissions, Permission.SPEAK)) {
            sources.add("microphone");
        }
        if (PermissionSet.has(permissions, Permission.USE_VIDEO)) {
            sources.add("camera");
        }
        if (PermissionSet.has(permissions, Permission.SHARE_SCREEN)) {
            sources.add("screen_share");
            sources.add("screen_share_audio");
        }
        return sources;
    }
}
