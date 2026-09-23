package com.concordmvp.dm;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DmConversationStateRepository extends JpaRepository<DmConversationState, UUID> {

    boolean existsByUserIdAndOtherUserId(UUID userId, UUID otherUserId);

    List<DmConversationState> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
}
