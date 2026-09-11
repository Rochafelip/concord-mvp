package com.concordmvp.users;

import com.concordmvp.auth.JwtService;
import com.concordmvp.auth.SessionCookieFactory;
import com.concordmvp.common.CurrentUser;
import com.concordmvp.users.dto.ChangePasswordRequest;
import com.concordmvp.users.dto.MeResponse;
import com.concordmvp.users.dto.UpdateProfileRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
import java.time.Duration;

@RestController
@RequestMapping("/api/v1/users")
public class UsersController {

    private final UserService userService;
    private final JwtService jwtService;
    private final SessionCookieFactory sessionCookieFactory;
    private final AvatarStorageService avatarStorageService;

    public UsersController(
            UserService userService,
            JwtService jwtService,
            SessionCookieFactory sessionCookieFactory,
            AvatarStorageService avatarStorageService
    ) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.sessionCookieFactory = sessionCookieFactory;
        this.avatarStorageService = avatarStorageService;
    }

    @PutMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MeResponse uploadAvatar(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        return toMeResponse(userService.updateAvatar(CurrentUser.id(), file));
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<Void> deleteAvatar() {
        userService.removeAvatar(CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/avatar")
    public ResponseEntity<byte[]> avatar(@PathVariable UUID userId) {
        User user = userService.getCurrentUser(userId);
        if (user.getAvatarStorageKey() == null) return ResponseEntity.notFound().build();
        try {
            Path path = avatarStorageService.resolve(user.getAvatarStorageKey());
            if (!Files.exists(path)) return ResponseEntity.notFound().build();
            String contentType = Files.probeContentType(path);
            MediaType mediaType = contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
            return ResponseEntity.ok().contentType(mediaType)
                    .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                    .body(Files.readAllBytes(path));
        } catch (java.io.IOException ex) {
            throw new com.concordmvp.common.exception.ResourceNotFoundException("Avatar not found");
        }
    }

    @GetMapping("/me")
    public MeResponse me() {
        User user = userService.getCurrentUser(CurrentUser.id());
        return toMeResponse(user);
    }

    @PatchMapping("/me")
    public MeResponse updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        User user = userService.updateProfile(CurrentUser.id(), request.username(), request.displayName());
        return toMeResponse(user);
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(CurrentUser.id(), request.currentPassword(), request.newPassword());
        String token = jwtService.generateToken(CurrentUser.id());
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookieFactory.create(token).toString())
                .build();
    }

    private MeResponse toMeResponse(User user) {
        return new MeResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getEmail(),
                UserAvatarUrls.url(user),
                user.isEmailVerified()
        );
    }
}
