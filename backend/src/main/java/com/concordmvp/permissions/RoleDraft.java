package com.concordmvp.permissions;

import java.util.Set;

/**
 * The mutable shape of a role, used for both create and update. On an update a {@code null} field
 * means "leave it as it is" — which is why {@code position} is a boxed {@code Integer} and
 * {@code permissions} a nullable {@code Set} rather than a {@code long}.
 */
public record RoleDraft(String name,
                        String description,
                        String color,
                        Integer position,
                        Set<Permission> permissions) {
}
