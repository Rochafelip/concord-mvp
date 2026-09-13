-- Create channel_read_states table for tracking read state per user per channel
CREATE TABLE IF NOT EXISTS channel_read_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_channel UNIQUE (user_id, channel_id)
);

-- Indexes for performance
CREATE INDEX idx_channel_read_states_user ON channel_read_states(user_id);
CREATE INDEX idx_channel_read_states_channel ON channel_read_states(channel_id);
CREATE INDEX idx_channel_read_states_user_channel ON channel_read_states(user_id, channel_id);

-- Initialize read states for existing users and channels
INSERT INTO channel_read_states (user_id, channel_id, last_read_at, unread_count, created_at, updated_at)
SELECT 
    sm.user_id,
    c.id as channel_id,
    now() as last_read_at,
    0 as unread_count,
    now() as created_at,
    now() as updated_at
FROM server_members sm
CROSS JOIN channels c
WHERE sm.server_id = c.server_id
ON CONFLICT (user_id, channel_id) DO NOTHING;
