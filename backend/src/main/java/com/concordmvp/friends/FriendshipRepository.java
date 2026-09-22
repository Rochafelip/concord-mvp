package com.concordmvp.friends;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    @Query("SELECT f FROM Friendship f WHERE (f.requesterId = :a AND f.addresseeId = :b) "
            + "OR (f.requesterId = :b AND f.addresseeId = :a)")
    Optional<Friendship> findByPair(@Param("a") UUID a, @Param("b") UUID b);

    /**
     * Atomically transitions to ACCEPTED only if still PENDING, so two concurrent accepts of the
     * same request (double-click, two tabs) can't both succeed — the loser gets 0 rows affected
     * instead of a second, duplicate {@code FRIEND_UPDATE} broadcast. The WHERE clause is
     * re-evaluated against the committed row once the DB grants the update lock, so this needs
     * no {@code @Version} column to be race-free under READ COMMITTED.
     */
    @Modifying
    @Query("UPDATE Friendship f SET f.status = 'ACCEPTED', f.updatedAt = CURRENT_TIMESTAMP "
            + "WHERE f.id = :id AND f.status = 'PENDING'")
    int acceptIfPending(@Param("id") UUID id);

    @Query("SELECT f FROM Friendship f WHERE f.status = 'ACCEPTED' "
            + "AND (f.requesterId = :userId OR f.addresseeId = :userId)")
    List<Friendship> findAcceptedForUser(@Param("userId") UUID userId);

    List<Friendship> findByStatusAndAddresseeId(FriendshipStatus status, UUID addresseeId);

    List<Friendship> findByStatusAndRequesterId(FriendshipStatus status, UUID requesterId);
}
