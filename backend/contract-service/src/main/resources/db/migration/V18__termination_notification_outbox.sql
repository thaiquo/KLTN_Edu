CREATE TABLE termination_notification_outbox (
    event_id VARCHAR(120) PRIMARY KEY,
    payload TEXT NOT NULL,
    recipients_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX termination_notification_pending ON termination_notification_outbox(delivered_at, next_attempt_at);
