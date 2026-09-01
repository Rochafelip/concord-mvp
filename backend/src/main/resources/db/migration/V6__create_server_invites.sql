CREATE TABLE server_invites (
    id          UUID PRIMARY KEY,
    server_id   UUID NOT NULL REFERENCES servers(id),
    code        VARCHAR(20) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_server_invites_server UNIQUE (server_id),
    CONSTRAINT uq_server_invites_code UNIQUE (code)
);
