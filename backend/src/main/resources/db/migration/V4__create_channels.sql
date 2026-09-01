CREATE TABLE channels (
    id          UUID PRIMARY KEY,
    server_id   UUID NOT NULL REFERENCES servers(id),
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(10) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_channels_type CHECK (type IN ('TEXT', 'VOICE'))
);
CREATE INDEX idx_channels_server_id ON channels(server_id);
