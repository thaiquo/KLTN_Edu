CREATE TABLE IF NOT EXISTS tutor_authorization_states (
    user_id BIGINT PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    tutor_profile_id BIGINT,
    source_event_id VARCHAR(80),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_tutor_authorization_states_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_tutor_authorization_states_status
    ON tutor_authorization_states (status);

INSERT INTO tutor_authorization_states (user_id, status, tutor_profile_id, source_event_id, updated_at)
SELECT DISTINCT user_id, 'APPROVED', tutor_profile_id, source_event_id, CURRENT_TIMESTAMP
FROM tutor_subjects
WHERE user_id IS NOT NULL
  AND active = TRUE
ON CONFLICT (user_id) DO NOTHING;
