CREATE TABLE class_sessions (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    topic VARCHAR(255),
    session_date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    meeting_link VARCHAR(500),
    assignment_title VARCHAR(255),
    assignment_description TEXT,
    assignment_file_url VARCHAR(1000),
    assignment_external_url VARCHAR(1000),
    assignment_due_at TIMESTAMP(6),
    submission_required BOOLEAN NOT NULL DEFAULT FALSE,
    late_submission_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    material_url VARCHAR(1000),
    material_description TEXT,
    material_external_url VARCHAR(1000),
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    settlement_dispatched BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_class_session_status CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT uq_class_session_sequence UNIQUE (class_room_id, sequence_number)
);

CREATE INDEX idx_class_sessions_room_date ON class_sessions(class_room_id, session_date);
CREATE INDEX idx_class_sessions_status ON class_sessions(status);
CREATE INDEX idx_class_sessions_assignment_due ON class_sessions(assignment_due_at);
CREATE INDEX idx_class_sessions_submission_policy ON class_sessions(submission_required, late_submission_allowed, assignment_due_at);

CREATE TABLE session_attendances (
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
    submission_text TEXT,
    submission_file_url VARCHAR(1000),
    submission_file_key VARCHAR(500),
    submission_file_name VARCHAR(255),
    submission_file_size BIGINT,
    submission_content_type VARCHAR(100),
    submitted_at TIMESTAMP(6),
    grade_score VARCHAR(50),
    tutor_feedback TEXT,
    graded_at TIMESTAMP(6),
    graded_by_tutor_email VARCHAR(255),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_session_attendance_outcome CHECK (final_outcome IS NULL OR final_outcome IN ('BOTH_PRESENT', 'STUDENT_ABSENT_TUTOR_PRESENT', 'TUTOR_ABSENT')),
    CONSTRAINT uq_session_student_att UNIQUE (session_id, student_id)
);

CREATE INDEX idx_session_attendances_session ON session_attendances(session_id);
CREATE INDEX idx_session_attendances_student ON session_attendances(student_id);
CREATE INDEX idx_session_attendances_graded_at ON session_attendances(graded_at);

CREATE TABLE session_files (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    file_category VARCHAR(30) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_size BIGINT,
    content_type VARCHAR(100),
    file_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_session_file_category CHECK (file_category IN ('ASSIGNMENT', 'MATERIAL'))
);

CREATE INDEX idx_session_files_session_id ON session_files(session_id);
CREATE INDEX idx_session_files_session_category ON session_files(session_id, file_category);
