package com.concordmvp.permissions.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Every field is optional: a null one means "leave it as it is". */
public record UpdateRoleRequest(@Size(max = 50) String name,
                                 @Size(max = 200) String description,
                                 @Size(max = 7) String color,
                                 @PositiveOrZero Integer position,
                                 List<String> permissions) {
}
