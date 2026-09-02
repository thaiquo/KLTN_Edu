-- Minimal identity snapshot required to create the later contract agreement.
-- Nullable keeps legacy requests readable; new enrollment requests validate these values.
ALTER TABLE enrollment_requests
    ADD COLUMN IF NOT EXISTS student_id BIGINT,
    ADD COLUMN IF NOT EXISTS student_phone VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_enrollment_req_student_id
    ON enrollment_requests(student_id, status);
