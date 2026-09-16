package com.concordmvp.permissions.dto;

import java.util.UUID;

/**
 * Deliberately thin: the client reacts by refetching, and every GET already returns the caller's
 * own effective permissions. Sending the permissions themselves would mean computing and
 * serializing a different payload per recipient.
 */
public record PermissionsUpdatePayload(UUID serverId) {
}
