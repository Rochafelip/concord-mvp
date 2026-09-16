package com.concordmvp.permissions;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MemberRoleRepository extends JpaRepository<MemberRole, MemberRole.Key> {

    boolean existsByServerMemberIdAndRoleId(UUID serverMemberId, UUID roleId);

    void deleteByRoleId(UUID roleId);

    /** The users currently holding a role — the recipient set for a PERMISSIONS_UPDATE broadcast. */
    @Query("""
            SELECT sm.userId FROM ServerMember sm
            WHERE sm.id IN (SELECT mr.serverMemberId FROM MemberRole mr WHERE mr.roleId = :roleId)
            """)
    List<UUID> findUserIdsByRoleId(@Param("roleId") UUID roleId);
}
