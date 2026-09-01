package com.concordmvp.users;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.users.dto.MeResponse;
import org.springframework.web.bind.annotation.GetMapping;
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
        UUID userId = CurrentUser.id();
        User user = userService.getCurrentUser(userId);
        return new MeResponse(user.getId(), user.getUsername(), user.getDisplayName(), user.getEmail(), user.getAvatarUrl());
    }
}
