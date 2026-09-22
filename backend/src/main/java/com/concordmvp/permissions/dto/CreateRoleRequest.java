package com.concordmvp.permissions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateRoleRequest(@NotBlank @Size(max = 50) String name,
                                 @Size(max = 200) String description,
                                 @Size(max = 7) String color,
                                 @PositiveOrZero Integer position,
                                 List<String> permissions) {
}
