package com.concordmvp.users;

import java.util.UUID;

public final class UserAvatarUrls {
    private UserAvatarUrls() {
    }

    public static String url(User user) {
        return user.getAvatarStorageKey() == null ? null : "/api/v1/users/" + user.getId() + "/avatar";
    }
}
