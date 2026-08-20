ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS max_pending_requests INTEGER NOT NULL DEFAULT 30;

UPDATE class_rooms SET max_pending_requests = CEIL(max_students * 1.5);

CREATE TABLE IF NOT EXISTS enrollment_requests (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    student_email VARCHAR(255) NOT NULL,
    student_name VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    join_key VARCHAR(50),
    note TEXT,
    reject_reason TEXT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_enrollment_request_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_enrollment_req_class_student ON enrollment_requests(class_room_id, lower(student_email));
CREATE INDEX IF NOT EXISTS idx_enrollment_req_student ON enrollment_requests(lower(student_email), status);
