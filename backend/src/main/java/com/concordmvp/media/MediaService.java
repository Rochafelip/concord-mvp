package com.concordmvp.media;

import com.concordmvp.channels.Channel;
import com.concordmvp.channels.ChannelService;
import com.concordmvp.channels.ChannelType;
import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import com.concordmvp.media.dto.VoiceTokenResponse;
import com.concordmvp.users.User;
import com.concordmvp.users.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
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
 */
@Service
public class MediaService {

    private static final Duration TOKEN_TTL = Duration.ofHours(6);

    private final ChannelService channelService;
    private final UserRepository userRepository;
    private final String livekitApiKey;
    private final SecretKey livekitSigningKey;
    private final String livekitPublicUrl;

    public MediaService(ChannelService channelService,
                         UserRepository userRepository,
                         @Value("${livekit.api-key}") String livekitApiKey,
                         @Value("${livekit.api-secret}") String livekitApiSecret,
                         @Value("${livekit.public-url}") String livekitPublicUrl) {
        this.channelService = channelService;
        this.userRepository = userRepository;
        this.livekitApiKey = livekitApiKey;
        this.livekitSigningKey = Keys.hmacShaKeyFor(livekitApiSecret.getBytes(StandardCharsets.UTF_8));
        this.livekitPublicUrl = livekitPublicUrl;
    }

    public VoiceTokenResponse issueVoiceToken(UUID channelId, UUID requesterId) {
        Channel channel = channelService.getChannel(channelId, requesterId);

        if (channel.getType() != ChannelType.VOICE) {
            throw new BadRequestException("Channel is not a voice channel: " + channelId);
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + requesterId));

        String roomName = "voice-channel-" + channel.getId();
        String token = buildLiveKitToken(requester, roomName);

        return new VoiceTokenResponse(token, livekitPublicUrl, roomName);
    }

    private String buildLiveKitToken(User requester, String roomName) {
        Instant now = Instant.now();
        Map<String, Object> videoGrant = Map.of(
                "roomJoin", true,
                "room", roomName,
                "canPublish", true,
                "canSubscribe", true
        );

        return Jwts.builder()
                .issuer(livekitApiKey)
                .subject(requester.getId().toString())
                .expiration(Date.from(now.plus(TOKEN_TTL)))
                .claim("name", requester.getDisplayName())
                .claim("video", videoGrant)
                .signWith(livekitSigningKey)
                .compact();
    }
}
