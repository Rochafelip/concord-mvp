package com.concordmvp.permissions;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assumptions.assumeThat;

/**
 * The permission vocabulary lives in two places: this enum, which owns the bit indexes, and
 * {@code frontend/src/types/permission.ts}, which the UI gates on. Nothing but this test stops
 * them drifting, and a drift only shows up in production as a control hidden from — or offered
 * to — the wrong people.
 *
 * <p>Lives on the backend side because it needs the filesystem, and the frontend's
 * {@code tsconfig.app.json} deliberately keeps Node's globals out of the app's type space.
 */
class PermissionVocabularySyncTest {

    private static final Path FRONTEND_PERMISSIONS =
            Path.of("..", "frontend", "src", "types", "permission.ts");

    @Test
    void theTypeScriptMirrorListsExactlyTheSamePermissions() throws IOException {
        // The backend is independently buildable (AGENTS.md), so a checkout without the frontend
        // must not fail this module's build.
        assumeThat(Files.isRegularFile(FRONTEND_PERMISSIONS))
                .as("frontend/src/types/permission.ts is present")
                .isTrue();

        String source = Files.readString(FRONTEND_PERMISSIONS, StandardCharsets.UTF_8);
        String block = source.substring(source.indexOf("ALL_PERMISSIONS = ["),
                source.indexOf("] as const;"));

        Matcher matcher = Pattern.compile("'([A-Z_]+)'").matcher(block);
        List<String> typescriptNames = matcher.results().map(result -> result.group(1)).toList();

        List<String> javaNames = Arrays.stream(Permission.values()).map(Enum::name).toList();

        assertThat(typescriptNames)
                .as("frontend/src/types/permission.ts must mirror Permission.java")
                .containsExactlyInAnyOrderElementsOf(javaNames);
    }
}
