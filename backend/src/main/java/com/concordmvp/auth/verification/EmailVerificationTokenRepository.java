package com.concordmvp.auth.verification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, UUID> {

    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    /** Issuing a new token retires the outstanding ones, so only the newest link ever works. */
    @Modifying
    @Query("UPDATE EmailVerificationToken t SET t.usedAt = :now WHERE t.userId = :userId AND t.usedAt IS NULL")
    void markAllUsedForUser(@Param("userId") UUID userId, @Param("now") Instant now);
}
