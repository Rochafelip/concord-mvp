CREATE TABLE dm_conversation_states (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id),
    other_user_id UUID NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dm_conversation_states_distinct CHECK (user_id <> other_user_id),
    CONSTRAINT uq_dm_conversation_states_pair UNIQUE (user_id, other_user_id)
);

CREATE INDEX idx_dm_conversation_states_user_id ON dm_conversation_states(user_id, created_at DESC);

-- Backfill: every pair that already exchanged a DM keeps seeing each other after this
-- migration, in both directions, so nobody loses a conversation they were already in on
-- deploy (same reasoning as V18's @everyone backfill).
INSERT INTO dm_conversation_states (id, user_id, other_user_id, created_at)
SELECT gen_random_uuid(), pair.user_low_id, pair.user_high_id, pair.first_message_at
FROM (
    SELECT user_low_id, user_high_id, MIN(created_at) AS first_message_at
    FROM dm_messages
    GROUP BY user_low_id, user_high_id
) pair
UNION ALL
SELECT gen_random_uuid(), pair.user_high_id, pair.user_low_id, pair.first_message_at
FROM (
    SELECT user_low_id, user_high_id, MIN(created_at) AS first_message_at
    FROM dm_messages
    GROUP BY user_low_id, user_high_id
) pair
ON CONFLICT (user_id, other_user_id) DO NOTHING;
