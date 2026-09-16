package com.concordmvp.permissions.dto;

import java.util.List;

/** Anything in neither list is INHERIT — it falls through to the server-level permissions. */
public record UpdateChannelOverrideRequest(List<String> allow, List<String> deny) {
}
