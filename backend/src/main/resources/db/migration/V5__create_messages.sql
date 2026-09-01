CREATE TABLE messages (
    id          UUID PRIMARY KEY,
    channel_id  UUID NOT NULL REFERENCES channels(id),
    author_id   UUID NOT NULL REFERENCES users(id),
    content     VARCHAR(4000) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_messages_content_not_blank CHECK (btrim(content) <> '')
);
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX idx_messages_author_id ON messages(author_id);
