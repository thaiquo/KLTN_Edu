-- Transaction-local on PostgreSQL; H2 PostgreSQL mode accepts set_config as a
-- compatibility no-op, so migration tests do not leak session lock settings.
SELECT set_config('lock_timeout', '5s', true);
SELECT set_config('statement_timeout', '60s', true);

CREATE TABLE agreement_trial (
    agreement_id UUID PRIMARY KEY REFERENCES contract_agreement(id),
    policy_version SMALLINT NOT NULL,
    trial_session_sequence INTEGER NOT NULL,
    next_session_sequence INTEGER NOT NULL,
    trial_session_start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    schedule_fingerprint VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL,
    decision_source VARCHAR(30),
    decision_at TIMESTAMP WITH TIME ZONE,
    opt_out_received_at TIMESTAMP WITH TIME ZONE,
    termination_case_id UUID UNIQUE REFERENCES termination_case(id),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_agreement_trial_policy_version CHECK (policy_version > 0),
    CONSTRAINT ck_agreement_trial_sequences CHECK (
        trial_session_sequence > 0
        AND next_session_sequence > trial_session_sequence
    ),
    CONSTRAINT ck_agreement_trial_deadline CHECK (trial_session_start_at < trial_deadline),
    CONSTRAINT ck_agreement_trial_status CHECK (
        status IN ('NOT_STARTED', 'DECISION_OPEN', 'CONTINUED', 'OPT_OUT_PENDING', 'LATE_FUNDING_RECOVERY', 'TERMINATED')
    ),
    CONSTRAINT ck_agreement_trial_decision_source CHECK (
        decision_source IS NULL OR decision_source IN ('AUTO_DEADLINE', 'STUDENT_OPT_OUT', 'SYSTEM_LATE_FUNDING')
    ),
    CONSTRAINT ck_agreement_trial_opt_out_state CHECK (
        status <> 'OPT_OUT_PENDING'
        OR (decision_source = 'STUDENT_OPT_OUT' AND opt_out_received_at IS NOT NULL AND termination_case_id IS NOT NULL)
    ),
    CONSTRAINT ck_agreement_trial_continued_state CHECK (
        status <> 'CONTINUED'
        OR (decision_source = 'AUTO_DEADLINE' AND decision_at IS NOT NULL)
    ),
    CONSTRAINT ck_agreement_trial_late_funding_state CHECK (
        status <> 'LATE_FUNDING_RECOVERY'
        OR (decision_source = 'SYSTEM_LATE_FUNDING' AND decision_at IS NOT NULL AND termination_case_id IS NOT NULL)
    ),
    CONSTRAINT ck_agreement_trial_terminated_state CHECK (
        status <> 'TERMINATED'
        OR (
            termination_case_id IS NOT NULL
            AND (
                (decision_source = 'STUDENT_OPT_OUT' AND opt_out_received_at IS NOT NULL)
                OR decision_source = 'SYSTEM_LATE_FUNDING'
            )
        )
    )
);

CREATE INDEX agreement_trial_deadline_idx
    ON agreement_trial(status, trial_deadline);
