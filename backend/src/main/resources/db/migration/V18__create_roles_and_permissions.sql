-- Roles and permissions.
--
-- Permissions are a 63-bit field in a BIGINT (see com.concordmvp.permissions.Permission and
-- docs/DECISIONS.md D20). The bit indexes are a persistence contract: renumbering one silently
-- reinterprets every row below.

CREATE TABLE roles (
    id          UUID PRIMARY KEY,
    server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    color       VARCHAR(7),
    position    INTEGER NOT NULL,
    permissions BIGINT NOT NULL DEFAULT 0,
    is_everyone BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_roles_position_non_negative CHECK (position >= 0)
);

CREATE INDEX idx_roles_server_id ON roles(server_id);

-- Exactly one @everyone per server.
CREATE UNIQUE INDEX uq_roles_everyone ON roles(server_id) WHERE is_everyone;

CREATE TABLE member_roles (
    server_member_id UUID NOT NULL REFERENCES server_members(id) ON DELETE CASCADE,
    role_id          UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (server_member_id, role_id)
);

CREATE INDEX idx_member_roles_role_id ON member_roles(role_id);

CREATE TABLE channel_permission_overrides (
    id         UUID PRIMARY KEY,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    role_id    UUID REFERENCES roles(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    allow      BIGINT NOT NULL DEFAULT 0,
    deny       BIGINT NOT NULL DEFAULT 0,
    -- An override targets a role or a user, never both and never neither.
    CONSTRAINT ck_override_single_target CHECK ((role_id IS NULL) <> (user_id IS NULL))
);

CREATE INDEX idx_overrides_channel_id ON channel_permission_overrides(channel_id);
CREATE UNIQUE INDEX uq_override_channel_role
    ON channel_permission_overrides(channel_id, role_id) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX uq_override_channel_user
    ON channel_permission_overrides(channel_id, user_id) WHERE user_id IS NOT NULL;

-- Give every pre-existing server an @everyone role granting exactly what every member could
-- already do before this migration, so nobody loses access on deploy.
--
--   506944 = VIEW_MEMBER_LIST(6) | VIEW_CHANNEL(10)   | SEND_MESSAGES(11)
--          | ATTACH_FILES(13)    | READ_MESSAGE_HISTORY(12)
--          | CONNECT(15)         | SPEAK(16) | USE_VIDEO(17) | SHARE_SCREEN(18)
--
-- Pinned against Permission.EVERYONE_DEFAULT by PermissionTest: the two must never drift, or
-- servers created before this migration and servers created after it would start out different.
INSERT INTO roles (id, server_id, name, description, color, position, permissions, is_everyone)
SELECT gen_random_uuid(), s.id, '@everyone', NULL, NULL, 0, 506944, TRUE
FROM servers s;
