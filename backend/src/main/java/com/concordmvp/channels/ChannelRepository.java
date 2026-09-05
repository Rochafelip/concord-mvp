package com.concordmvp.channels;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChannelRepository extends JpaRepository<Channel, UUID> {

    List<Channel> findByServerId(UUID serverId);

    Optional<Channel> findByServerIdAndType(UUID serverId, ChannelType type);

    long deleteByServerId(UUID serverId);
}
