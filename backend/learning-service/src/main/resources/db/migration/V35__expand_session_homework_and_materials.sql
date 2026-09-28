-- V35: Expand class_sessions with assignment deadline & materials, and session_attendances with grading & feedback

ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS assignment_due_at TIMESTAMP(6),
    ADD COLUMN IF NOT EXISTS material_url VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS material_description TEXT;

ALTER TABLE session_attendances
    ADD COLUMN IF NOT EXISTS grade_score VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tutor_feedback TEXT,
    ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP(6),
    ADD COLUMN IF NOT EXISTS graded_by_tutor_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_class_sessions_assignment_due ON class_sessions(assignment_due_at);
CREATE INDEX IF NOT EXISTS idx_session_attendances_graded_at ON session_attendances(graded_at);
