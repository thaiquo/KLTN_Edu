CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(120) NOT NULL,
    recipient_user_id BIGINT NOT NULL,
    target_role VARCHAR(40),
    type VARCHAR(80) NOT NULL,
    title VARCHAR(180) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    reference_type VARCHAR(80),
    reference_id VARCHAR(120),
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_notifications_event_recipient UNIQUE (event_id, recipient_user_id)
);

CREATE INDEX idx_notifications_recipient_created
    ON notifications (recipient_user_id, created_at DESC);

CREATE INDEX idx_notifications_recipient_read
    ON notifications (recipient_user_id, read_at);
