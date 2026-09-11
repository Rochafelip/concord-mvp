package com.concordmvp.users;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.users.dto.ChangePasswordRequest;
import com.concordmvp.users.dto.MeResponse;
import com.concordmvp.users.dto.UpdateProfileRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UsersController {

    private final UserService userService;

    public UsersController(UserService userService) {
        this.userService = userService;
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
        return ResponseEntity.noContent().build();
    }

    private MeResponse toMeResponse(User user) {
        return new MeResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getEmail(),
                user.getAvatarUrl(),
                user.isEmailVerified()
        );
    }
}
