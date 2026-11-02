ALTER TABLE dispute ADD COLUMN escalation_status VARCHAR(30) NOT NULL DEFAULT 'NONE';
ALTER TABLE dispute ADD COLUMN escalation_reason TEXT;
ALTER TABLE dispute ADD COLUMN escalated_by_user_id BIGINT;
ALTER TABLE dispute ADD COLUMN escalated_by_email VARCHAR(255);
ALTER TABLE dispute ADD COLUMN escalated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dispute ADD COLUMN escalation_handled_by_user_id BIGINT;
ALTER TABLE dispute ADD COLUMN escalation_handled_by_email VARCHAR(255);
ALTER TABLE dispute ADD COLUMN escalation_handled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dispute ADD COLUMN escalation_return_reason TEXT;
ALTER TABLE dispute ADD CONSTRAINT ck_dispute_escalation_status CHECK (escalation_status IN
    ('NONE', 'PENDING_ADMIN', 'ACCEPTED_BY_ADMIN', 'RETURNED_TO_STAFF', 'CLOSED'));

CREATE TABLE dispute_history (
    id UUID PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES dispute(id) ON DELETE CASCADE,
    actor_user_id BIGINT,
    actor_email VARCHAR(255),
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_state VARCHAR(50),
    to_state VARCHAR(50),
    reason TEXT,
    idempotency_key VARCHAR(180) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dispute_escalation_queue
    ON dispute(escalation_status, escalated_at DESC);
CREATE INDEX idx_dispute_history_timeline
    ON dispute_history(dispute_id, created_at, id);
