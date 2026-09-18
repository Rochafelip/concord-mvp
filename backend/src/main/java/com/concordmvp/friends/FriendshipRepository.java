package com.concordmvp.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    @Query("SELECT f FROM Friendship f WHERE (f.requesterId = :a AND f.addresseeId = :b) "
            + "OR (f.requesterId = :b AND f.addresseeId = :a)")
    Optional<Friendship> findByPair(@Param("a") UUID a, @Param("b") UUID b);

    @Query("SELECT f FROM Friendship f WHERE f.status = 'ACCEPTED' "
            + "AND (f.requesterId = :userId OR f.addresseeId = :userId)")
    List<Friendship> findAcceptedForUser(@Param("userId") UUID userId);

    List<Friendship> findByStatusAndAddresseeId(FriendshipStatus status, UUID addresseeId);

    List<Friendship> findByStatusAndRequesterId(FriendshipStatus status, UUID requesterId);
}
