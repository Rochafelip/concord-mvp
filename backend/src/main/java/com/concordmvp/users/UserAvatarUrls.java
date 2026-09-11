package com.concordmvp.users;

import java.util.UUID;

public final class UserAvatarUrls {
    private UserAvatarUrls() {
    }

    public static String url(User user) {
        if (user.getAvatarStorageKey() == null) return null;
        String base = "/api/v1/users/" + user.getId() + "/avatar";
        return user.getUpdatedAt() == null ? base : base + "?v=" + user.getUpdatedAt().toEpochMilli();
    }
}
