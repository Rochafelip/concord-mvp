package com.concordmvp.permissions;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    List<Role> findByServerIdOrderByPositionDescNameAsc(UUID serverId);

    /**
     * Every role that applies to one membership: the server's {@code @everyone} plus whatever is
     * assigned to it. One query instead of "fetch assignments, then fetch roles by id".
     */
    @Query("""
            SELECT r FROM Role r
            WHERE r.serverId = :serverId
              AND (r.everyone = TRUE
                   OR r.id IN (SELECT mr.roleId FROM MemberRole mr WHERE mr.serverMemberId = :serverMemberId))
            ORDER BY r.position DESC
            """)
    List<Role> findEffectiveRoles(@Param("serverId") UUID serverId,
                                   @Param("serverMemberId") UUID serverMemberId);

    void deleteByServerId(UUID serverId);
}
