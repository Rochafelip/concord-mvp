package com.concordmvp.permissions;

import java.util.UUID;

/** One entry of a batch reorder. */
public record RolePosition(UUID roleId, int position) {
}
