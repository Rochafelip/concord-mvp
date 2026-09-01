CREATE TABLE server_members (
    id          UUID PRIMARY KEY,
    server_id   UUID NOT NULL REFERENCES servers(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_server_members_server_user UNIQUE (server_id, user_id)
);
CREATE INDEX idx_server_members_user_id ON server_members(user_id);
