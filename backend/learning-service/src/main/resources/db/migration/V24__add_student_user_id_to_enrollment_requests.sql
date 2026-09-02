ALTER TABLE enrollment_requests
    ADD COLUMN IF NOT EXISTS student_user_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_enrollment_req_student_user
    ON enrollment_requests(student_user_id, status);
