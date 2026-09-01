package com.concordmvp.servers;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ServerInviteRepository extends JpaRepository<ServerInvite, UUID> {

    Optional<ServerInvite> findByCode(String code);

    Optional<ServerInvite> findByServerId(UUID serverId);
}
