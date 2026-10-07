ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS submission_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS late_submission_allowed BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE class_sessions
SET submission_required = TRUE
WHERE assignment_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_class_sessions_submission_policy
    ON class_sessions(submission_required, late_submission_allowed, assignment_due_at);
