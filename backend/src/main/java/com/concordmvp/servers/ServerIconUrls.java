package com.concordmvp.servers;

public final class ServerIconUrls {
    private ServerIconUrls() {
    }

    public static String url(Server server) {
        if (server.getIconStorageKey() == null) return null;
        String base = "/api/v1/servers/" + server.getId() + "/icon";
        return server.getUpdatedAt() == null ? base : base + "?v=" + server.getUpdatedAt().toEpochMilli();
    }
}
