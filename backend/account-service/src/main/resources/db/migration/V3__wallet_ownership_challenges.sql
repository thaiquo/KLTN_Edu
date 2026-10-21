CREATE TABLE wallet_ownership_challenges (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    wallet_address VARCHAR(42) NOT NULL,
    challenge_text TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_challenge_user ON wallet_ownership_challenges(user_id, expires_at);
