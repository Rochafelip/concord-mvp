-- A message used to carry at most one attachment, stored inline on `messages` as
-- (image_url, file_name, file_size). Attachments move to their own table so a single
-- message can carry several, ordered by `position`.
CREATE TABLE message_attachments (
    id         UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url        VARCHAR(500) NOT NULL,
    file_name  VARCHAR(255),
    file_size  BIGINT,
    position   INT NOT NULL,
    CONSTRAINT uq_message_attachments_position UNIQUE (message_id, position)
);

CREATE INDEX idx_message_attachments_message ON message_attachments(message_id);

-- Carry the existing single attachments over before the columns holding them are dropped.
INSERT INTO message_attachments (id, message_id, url, file_name, file_size, position)
SELECT gen_random_uuid(), id, image_url, file_name, file_size, 0
FROM messages
WHERE image_url IS NOT NULL;

ALTER TABLE messages
    DROP COLUMN image_url,
    DROP COLUMN file_name,
    DROP COLUMN file_size;
