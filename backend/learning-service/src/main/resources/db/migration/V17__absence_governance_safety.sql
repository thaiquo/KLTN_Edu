-- Transaction-local on PostgreSQL; H2 PostgreSQL mode accepts set_config as a
-- compatibility no-op, so migration tests do not leak session lock settings.
SELECT set_config('lock_timeout', '5s', true);
SELECT set_config('statement_timeout', '60s', true);

-- 1. Extend class_sessions for finalization audit and governance snapshot
ALTER TABLE class_sessions ADD COLUMN attendance_finalized_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE class_sessions ADD COLUMN governance_next_session_sequence INTEGER;
ALTER TABLE class_sessions ADD COLUMN governance_next_session_start_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE class_sessions ADD COLUMN governance_snapshot_captured_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE class_sessions
    ADD CONSTRAINT ck_class_session_governance_snapshot CHECK (
        (governance_snapshot_captured_at IS NULL
            AND governance_next_session_sequence IS NULL
            AND governance_next_session_start_at IS NULL)
        OR (governance_snapshot_captured_at IS NOT NULL
            AND
            attendance_finalized_at IS NOT NULL
            AND (
                (governance_next_session_sequence IS NULL AND governance_next_session_start_at IS NULL)
                OR (
                    governance_next_session_sequence > sequence_number
                    AND governance_next_session_start_at IS NOT NULL
                    AND governance_next_session_start_at > attendance_finalized_at
                )
            )
        )
    );

-- 2. Command inbox for HOLD, RELEASE, FREEZE, CLOSE idempotency and ordering
CREATE TABLE learning_termination_command_inbox (
    id UUID PRIMARY KEY,
    command_id UUID NOT NULL,
    action VARCHAR(30) NOT NULL,
    classroom_id BIGINT NOT NULL,
    agreement_id VARCHAR(36) NOT NULL,
    cutoff_session INTEGER NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL,
    required_session_sequences_csv TEXT NOT NULL,
    next_session_start_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_learning_command_inbox UNIQUE (command_id, action),
    CONSTRAINT ck_learning_command_inbox_action CHECK (action IN ('HOLD', 'RELEASE', 'FREEZE', 'CLOSE')),
    CONSTRAINT ck_learning_command_inbox_cutoff CHECK (cutoff_session >= 0),
    CONSTRAINT ck_learning_command_inbox_status CHECK (status = 'COMPLETED'),
    CONSTRAINT ck_learning_command_inbox_payload_hash CHECK (CHAR_LENGTH(payload_hash) = 64)
);

CREATE INDEX idx_learning_command_inbox_class
    ON learning_termination_command_inbox(classroom_id, action, created_at);
