-- Security audit A8 (docs/security-audit-2026-09-18.md): username is used as a public
-- identity (friend requests, DMs, member lists) but was never guaranteed unique.
--
-- Duplicates were possible before this constraint, so normalize them first: keep the
-- oldest account's username untouched, and suffix every later duplicate with part of its
-- own id. Friends/DMs reference users by id, not username, so renaming here is safe.
WITH ranked AS (
    SELECT id, username,
           ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at, id) AS rn
    FROM users
)
UPDATE users
SET username = left(ranked.username, 41) || '_' || substring(ranked.id::text, 1, 8)
FROM ranked
WHERE users.id = ranked.id
  AND ranked.rn > 1;

ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username);
