ALTER TABLE otp_verifications
    ADD COLUMN invalidated BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN used_at TIMESTAMP(6);

CREATE INDEX idx_otp_verifications_active_lookup
    ON otp_verifications (user_id, type, verified, invalidated, created_at DESC);
