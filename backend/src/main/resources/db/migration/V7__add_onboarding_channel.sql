-- Widen the channel type constraint to allow the new system-managed ONBOARDING type.
ALTER TABLE channels DROP CONSTRAINT chk_channels_type;
ALTER TABLE channels ADD CONSTRAINT chk_channels_type CHECK (type IN ('TEXT', 'VOICE', 'ONBOARDING'));

-- Reserved system user: authors every onboarding message. The password hash below is a valid
-- bcrypt hash of a random value nobody knows, so logging in as this account is not possible;
-- even if it somehow were, this user is never a server_members row, so the app's own
-- "must be a member of this server" checks (ChannelService/MessageService) would still reject
-- any action it tried to take through the normal API.
INSERT INTO users (id, username, display_name, email, password_hash, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System',
    'System',
    'system@concord.internal',
    '$2b$12$WYk/TI3ypxphQGgiTszxieGEerEgxhFloxzp1EvoeT5iPEJ0M.s0i',
    now(),
    now()
);

-- One onboarding channel per existing server.
INSERT INTO channels (id, server_id, name, type, created_at, updated_at)
SELECT gen_random_uuid(), s.id, 'onboarding', 'ONBOARDING', now(), now()
FROM servers s;

-- Backfill: one system message per existing membership, timestamped at that member's original
-- joined_at (not now()), so the channel opens with real history in the real join order instead
-- of being empty.
INSERT INTO messages (id, channel_id, author_id, content, created_at, updated_at)
SELECT gen_random_uuid(),
       c.id,
       '00000000-0000-0000-0000-000000000001',
       u.display_name || ' entrou no servidor',
       sm.joined_at,
       sm.joined_at
FROM server_members sm
JOIN channels c ON c.server_id = sm.server_id AND c.type = 'ONBOARDING'
JOIN users u ON u.id = sm.user_id;
