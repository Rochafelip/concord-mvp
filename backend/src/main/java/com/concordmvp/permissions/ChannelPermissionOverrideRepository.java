package com.concordmvp.permissions;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannelPermissionOverrideRepository extends JpaRepository<ChannelPermissionOverride, UUID> {

    List<ChannelPermissionOverride> findByChannelId(UUID channelId);

    /** Bulk form used by filterVisible so listing N channels stays at one query, not N. */
    List<ChannelPermissionOverride> findByChannelIdIn(Collection<UUID> channelIds);

    Optional<ChannelPermissionOverride> findByChannelIdAndRoleId(UUID channelId, UUID roleId);

    Optional<ChannelPermissionOverride> findByChannelIdAndUserId(UUID channelId, UUID userId);

    void deleteByRoleId(UUID roleId);
}
