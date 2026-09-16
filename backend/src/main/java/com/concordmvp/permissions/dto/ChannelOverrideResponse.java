package com.concordmvp.permissions.dto;

import com.concordmvp.permissions.ChannelPermissionOverride;
import com.concordmvp.permissions.PermissionSet;

import java.util.List;
import java.util.UUID;

/** Exactly one of {@code roleId}/{@code userId} is non-null — see the table's CHECK constraint. */
public record ChannelOverrideResponse(UUID id,
                                       UUID channelId,
                                       UUID roleId,
                                       UUID userId,
                                       List<String> allow,
                                       List<String> deny) {

    public static ChannelOverrideResponse from(ChannelPermissionOverride override) {
        return new ChannelOverrideResponse(override.getId(), override.getChannelId(),
                override.getRoleId(), override.getUserId(),
                PermissionSet.toNames(override.getAllow()), PermissionSet.toNames(override.getDeny()));
    }
}
