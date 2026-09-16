package com.concordmvp.permissions.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;
import java.util.UUID;

/**
 * Reordering is one batched request rather than one per role: two concurrent single-role moves
 * would interleave and leave the hierarchy in a state neither caller asked for.
 */
public record RolePositionsRequest(@NotEmpty List<@NotNull Entry> roles) {

    public record Entry(@NotNull UUID roleId, @PositiveOrZero int position) {
    }
}
