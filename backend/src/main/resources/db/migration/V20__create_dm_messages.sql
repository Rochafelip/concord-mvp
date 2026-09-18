CREATE TABLE dm_messages (
    id            UUID PRIMARY KEY,
    user_low_id   UUID NOT NULL REFERENCES users(id),
    user_high_id  UUID NOT NULL REFERENCES users(id),
    author_id     UUID NOT NULL REFERENCES users(id),
    content       VARCHAR(4000) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dm_messages_content_not_blank CHECK (btrim(content) <> ''),
    -- Normalized ordering (not who-sent-first): keeps every message for a pair under one key
    -- regardless of who started the conversation, so a lookup never has to try both orderings.
    CONSTRAINT chk_dm_messages_ordered_pair CHECK (user_low_id < user_high_id)
);

CREATE INDEX idx_dm_messages_pair_created ON dm_messages(user_low_id, user_high_id, created_at);
