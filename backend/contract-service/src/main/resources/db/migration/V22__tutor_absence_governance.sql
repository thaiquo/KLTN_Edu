-- Transaction-local on PostgreSQL; H2 PostgreSQL mode accepts set_config as a
-- compatibility no-op, so migration tests do not leak session lock settings.
SELECT set_config('lock_timeout', '5s', true);
SELECT set_config('statement_timeout', '60s', true);

-- 1. Extend termination_case for absence governance v1
ALTER TABLE termination_case ADD COLUMN absence_governance_version SMALLINT;
ALTER TABLE termination_case ADD COLUMN trigger_session_sequence INTEGER;
ALTER TABLE termination_case ADD COLUMN next_session_sequence INTEGER;
ALTER TABLE termination_case ADD COLUMN next_session_start_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE termination_case ADD COLUMN hold_effective_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE termination_case ADD COLUMN hold_command_id UUID;
ALTER TABLE termination_case ADD COLUMN release_command_id UUID;
ALTER TABLE termination_case ADD COLUMN decision_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE termination_case ADD COLUMN auto_decision_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE termination_case ADD COLUMN auto_decision_reason VARCHAR(40);

ALTER TABLE termination_case
    ADD CONSTRAINT ck_termination_case_governance_version
        CHECK (absence_governance_version IS NULL OR absence_governance_version = 1);

ALTER TABLE termination_case
    ADD CONSTRAINT ck_termination_case_governance_sequences
        CHECK (
            absence_governance_version IS NULL
            OR (origin = 'AUTO_TUTOR_ABSENCE' AND
                trigger_session_sequence IS NOT NULL
                AND trigger_session_sequence > 0
                AND next_session_sequence IS NOT NULL
                AND next_session_sequence > trigger_session_sequence
            )
            OR (origin = 'AUTO_TUTOR_ABSENCE_RELAPSE' AND
                trigger_session_sequence IS NOT NULL
                AND trigger_session_sequence > 0
                AND next_session_sequence IS NULL
            )
        );

ALTER TABLE termination_case
    ADD CONSTRAINT ck_termination_case_governance_deadlines
        CHECK (
            absence_governance_version IS NULL
            OR (origin = 'AUTO_TUTOR_ABSENCE' AND
                next_session_start_at IS NOT NULL
                AND decision_deadline IS NOT NULL
                AND decision_deadline = next_session_start_at
                AND response_deadline IS NOT NULL
                AND response_deadline <= decision_deadline
            )
            OR (origin = 'AUTO_TUTOR_ABSENCE_RELAPSE' AND
                next_session_start_at IS NULL
                AND decision_deadline IS NULL
                AND response_deadline IS NULL
            )
        );

ALTER TABLE termination_case
    ADD CONSTRAINT ck_termination_case_governance_scope
        CHECK (
            absence_governance_version IS NULL
            OR (
                whole_class = TRUE
                AND origin IN ('AUTO_TUTOR_ABSENCE', 'AUTO_TUTOR_ABSENCE_RELAPSE')
                AND hold_command_id IS NOT NULL
            )
        );

ALTER TABLE termination_case
    ADD CONSTRAINT ck_termination_case_auto_decision
        CHECK (
            absence_governance_version IS NULL
            OR (
                (auto_decision_at IS NULL AND auto_decision_reason IS NULL)
                OR (
                    auto_decision_at IS NOT NULL
                    AND auto_decision_reason IS NOT NULL
                    AND auto_decision_reason IN (
                        'NO_TUTOR_RESPONSE',
                        'NO_ADMIN_DECISION',
                        'INSUFFICIENT_REVIEW_WINDOW',
                        'HOLD_SYNC_TIMEOUT',
                        'PROBATION_RELAPSE',
                        'RELEASE_TIMEOUT'
                    )
                )
            )
        );

CREATE INDEX idx_termination_case_gov_deadlines
    ON termination_case(absence_governance_version, status, response_deadline, decision_deadline);

CREATE INDEX idx_termination_case_gov_response_expiry
    ON termination_case(absence_governance_version, tutor_responded_at, response_deadline, id);

CREATE INDEX idx_termination_case_gov_decision_expiry
    ON termination_case(absence_governance_version, decision_deadline, id);

-- 2. Dedicated probation table
CREATE TABLE tutor_absence_probation (
    id UUID PRIMARY KEY,
    classroom_id BIGINT NOT NULL,
    source_case_id UUID NOT NULL UNIQUE REFERENCES termination_case(id),
    session_sequence INTEGER NOT NULL,
    session_start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL,
    active_classroom_guard BIGINT,
    failure_case_id UUID UNIQUE REFERENCES termination_case(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_tutor_absence_probation_sequence CHECK (session_sequence > 0),
    CONSTRAINT ck_tutor_absence_probation_status CHECK (
        status IN ('ACTIVE', 'PASSED', 'FAILED', 'CANCELLED')
    ),
    CONSTRAINT ck_tutor_absence_probation_active_guard CHECK (
        (status = 'ACTIVE' AND active_classroom_guard = classroom_id)
        OR (status <> 'ACTIVE' AND active_classroom_guard IS NULL)
    ),
    CONSTRAINT ck_tutor_absence_probation_resolution CHECK (
        (status = 'ACTIVE' AND resolved_at IS NULL AND failure_case_id IS NULL)
        OR (status IN ('PASSED', 'CANCELLED') AND resolved_at IS NOT NULL AND failure_case_id IS NULL)
        OR (status = 'FAILED' AND resolved_at IS NOT NULL AND failure_case_id IS NOT NULL)
    )
);

ALTER TABLE tutor_absence_probation
    ADD CONSTRAINT uq_tutor_absence_probation_active_class UNIQUE (active_classroom_guard);

CREATE INDEX idx_tutor_absence_probation_class_status
    ON tutor_absence_probation(classroom_id, status);

CREATE INDEX idx_tutor_absence_probation_scan
    ON tutor_absence_probation(session_sequence, classroom_id, status);

CREATE INDEX idx_tutor_absence_probation_active_lookup
    ON tutor_absence_probation(classroom_id, status, id);

-- 3. Integration projection for class-level tutor attendance signal
CREATE TABLE class_tutor_attendance_signal (
    id UUID PRIMARY KEY,
    classroom_id BIGINT NOT NULL,
    learning_session_id BIGINT NOT NULL,
    session_sequence INTEGER NOT NULL,
    tutor_attendance_outcome VARCHAR(20) NOT NULL,
    finalized_at TIMESTAMP WITH TIME ZONE NOT NULL,
    next_session_sequence INTEGER,
    next_session_start_at TIMESTAMP WITH TIME ZONE,
    source_event_id VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_attendance_signal_sequence CHECK (session_sequence > 0),
    CONSTRAINT ck_attendance_signal_outcome CHECK (
        tutor_attendance_outcome IN ('TUTOR_PRESENT', 'TUTOR_ABSENT', 'INCONSISTENT', 'UNAVAILABLE')
    ),
    CONSTRAINT ck_attendance_signal_next_snapshot CHECK (
        (next_session_sequence IS NULL AND next_session_start_at IS NULL)
        OR (next_session_sequence > session_sequence
            AND next_session_start_at IS NOT NULL
            AND next_session_start_at > finalized_at)
    ),
    CONSTRAINT uq_class_tutor_attendance_signal_seq UNIQUE (classroom_id, session_sequence),
    CONSTRAINT uq_class_tutor_attendance_signal_session UNIQUE (classroom_id, learning_session_id)
);

CREATE INDEX idx_class_tutor_attendance_signal_scan
    ON class_tutor_attendance_signal(classroom_id, session_sequence, tutor_attendance_outcome);
