CREATE TABLE friendships (
    id            UUID PRIMARY KEY,
    requester_id  UUID NOT NULL REFERENCES users(id),
    addressee_id  UUID NOT NULL REFERENCES users(id),
    status        VARCHAR(10) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_friendships_status CHECK (status IN ('PENDING', 'ACCEPTED')),
    CONSTRAINT chk_friendships_not_self CHECK (requester_id <> addressee_id)
);

-- One row per unordered pair, regardless of who requested whom.
CREATE UNIQUE INDEX uq_friendships_pair
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee_id ON friendships(addressee_id);
