-- Create channel_read_states table for tracking unread messages per user per channel
CREATE TABLE channel_read_states (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_user_channel UNIQUE (user_id, channel_id)
);

-- Create indexes for performance
CREATE INDEX idx_channel_read_states_user ON channel_read_states(user_id);
CREATE INDEX idx_channel_read_states_channel ON channel_read_states(channel_id);
CREATE INDEX idx_channel_read_states_user_channel ON channel_read_states(user_id, channel_id);

-- Initialize read states for existing user-channel pairs
-- This ensures existing users start with clean read states
INSERT INTO channel_read_states (id, user_id, channel_id, last_read_at, unread_count)
SELECT 
    gen_random_uuid(),
    sm.user_id,
    c.id,
    now(),
    0
FROM server_members sm
JOIN channels c ON c.server_id = sm.server_id
ON CONFLICT (user_id, channel_id) DO NOTHING;
