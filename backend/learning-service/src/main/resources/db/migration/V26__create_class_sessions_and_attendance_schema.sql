-- V26: Create class_sessions and session_attendances schema for rolling sessions and attendance

CREATE TABLE IF NOT EXISTS class_sessions (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    topic VARCHAR(255),
    session_date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    assignment_title VARCHAR(255),
    assignment_description TEXT,
    assignment_file_url VARCHAR(1000),
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_class_session_status CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT uq_class_session_sequence UNIQUE (class_room_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_room_date ON class_sessions(class_room_id, session_date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON class_sessions(status);

CREATE TABLE IF NOT EXISTS session_attendances (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL,
    student_email VARCHAR(255),
    student_name VARCHAR(255),
    tutor_id BIGINT NOT NULL,
    tutor_checked BOOLEAN NOT NULL DEFAULT FALSE,
    tutor_checked_at TIMESTAMP(6),
    student_checked BOOLEAN NOT NULL DEFAULT FALSE,
    student_checked_at TIMESTAMP(6),
    final_outcome VARCHAR(40),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_session_attendance_outcome CHECK (final_outcome IS NULL OR final_outcome IN ('BOTH_PRESENT', 'STUDENT_ABSENT_TUTOR_PRESENT', 'TUTOR_ABSENT')),
    CONSTRAINT uq_session_student_att UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_session_attendances_session ON session_attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attendances_student ON session_attendances(student_id);
