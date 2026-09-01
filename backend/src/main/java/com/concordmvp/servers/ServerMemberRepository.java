package com.concordmvp.servers;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServerMemberRepository extends JpaRepository<ServerMember, UUID> {

    List<ServerMember> findByUserId(UUID userId);

    List<ServerMember> findByServerId(UUID serverId);

    Optional<ServerMember> findByServerIdAndUserId(UUID serverId, UUID userId);

    boolean existsByServerIdAndUserId(UUID serverId, UUID userId);
}
