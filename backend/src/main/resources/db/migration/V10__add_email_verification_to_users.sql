ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Used from the password reset flow onwards: every session issued before this instant stops
-- being accepted. Created here so users takes a single ALTER.
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;

-- Existing accounts predate the rule. Demanding retroactive verification would lock out people
-- who are already using the system.
UPDATE users SET email_verified = TRUE;
