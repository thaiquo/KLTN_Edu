CREATE TABLE class_rooms (
    id BIGSERIAL PRIMARY KEY,
    tutor_subject_registration_id BIGINT NOT NULL REFERENCES tutor_subject_registrations(id),
    level_id BIGINT NOT NULL REFERENCES catalog_levels(id),
    tutor_email VARCHAR(255) NOT NULL,
    tutor_profile_id BIGINT,
    tutor_full_name VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    learning_mode VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    meeting_link VARCHAR(500),
    address VARCHAR(500),
    max_students INTEGER NOT NULL DEFAULT 20,
    max_pending_requests INTEGER NOT NULL DEFAULT 30,
    price_per_session NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    sessions_per_week INTEGER NOT NULL DEFAULT 3,
    duration_per_session_minutes INTEGER NOT NULL DEFAULT 90,
    duration_value INTEGER NOT NULL DEFAULT 3,
    duration_unit VARCHAR(20) NOT NULL DEFAULT 'MONTH',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_sessions INTEGER NOT NULL,
    termination_cutoff_session INTEGER,
    syllabus_mode VARCHAR(20) NOT NULL DEFAULT 'FORM',
    syllabus_file_url VARCHAR(1000),
    syllabus_file_key VARCHAR(500),
    syllabus_file_name VARCHAR(255),
    syllabus_file_size BIGINT,
    syllabus_content_type VARCHAR(100),
    join_mode VARCHAR(30) NOT NULL DEFAULT 'OPEN_REQUEST',
    join_key VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    reject_reason TEXT,
    reviewed_by_email VARCHAR(255),
    reviewed_at TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_class_room_status CHECK (status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','PRIVATE','PUBLISHED','LOCKED','REJECTED','CLOSED','CANCELLED')),
    CONSTRAINT ck_class_room_learning_mode CHECK (learning_mode IN ('ONLINE', 'OFFLINE')),
    CONSTRAINT ck_class_room_syllabus_mode CHECK (syllabus_mode IN ('FORM', 'FILE', 'BOTH')),
    CONSTRAINT ck_class_room_duration_unit CHECK (duration_unit IN ('WEEK', 'MONTH')),
    CONSTRAINT ck_class_room_join_mode CHECK (join_mode IN ('OPEN_REQUEST', 'INVITE_KEY'))
);

CREATE INDEX idx_class_rooms_tutor ON class_rooms(lower(tutor_email), status);
CREATE INDEX idx_class_rooms_registration ON class_rooms(tutor_subject_registration_id);
CREATE INDEX idx_class_rooms_reviewed_by ON class_rooms(lower(reviewed_by_email), status) WHERE reviewed_by_email IS NOT NULL;

CREATE TABLE class_schedules (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    CONSTRAINT ck_class_schedule_day CHECK (day_of_week BETWEEN 2 AND 8)
);

CREATE INDEX idx_class_schedules_class ON class_schedules(class_room_id);

CREATE TABLE class_chapters (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    expected_sessions INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_class_chapters_class ON class_chapters(class_room_id);

CREATE TABLE tutor_availabilities (
    id BIGSERIAL PRIMARY KEY,
    tutor_email VARCHAR(255) NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6)
);

CREATE INDEX idx_tutor_avail_email ON tutor_availabilities(lower(tutor_email));

CREATE TABLE enrollment_requests (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    student_email VARCHAR(255) NOT NULL,
    student_id BIGINT,
    student_name VARCHAR(255),
    student_phone VARCHAR(50),
    student_wallet VARCHAR(42),
    student_date_of_birth DATE,
    student_address VARCHAR(500),
    agreement_id VARCHAR(36),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    join_key VARCHAR(50),
    note TEXT,
    reject_reason TEXT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_enrollment_request_status CHECK (status IN ('PENDING', 'ACCEPTED', 'ENROLLED', 'EXPIRED', 'REJECTED', 'CANCELLED'))
);

CREATE INDEX idx_enrollment_req_class_student ON enrollment_requests(class_room_id, lower(student_email));
CREATE INDEX idx_enrollment_req_student ON enrollment_requests(lower(student_email), status);
CREATE INDEX idx_enrollment_req_student_id ON enrollment_requests(student_id);
CREATE INDEX idx_enrollment_req_agreement_id ON enrollment_requests(agreement_id);
CREATE INDEX idx_enrollment_req_student_wallet ON enrollment_requests(student_wallet);

CREATE TABLE tutor_authorization_states (
    user_id BIGINT PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    tutor_profile_id BIGINT,
    source_event_id VARCHAR(80),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_tutor_authorization_states_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX idx_tutor_authorization_states_status ON tutor_authorization_states(status);

CREATE TABLE tutor_authorization_teaching_modes (
    user_id BIGINT NOT NULL REFERENCES tutor_authorization_states(user_id) ON DELETE CASCADE,
    teaching_mode VARCHAR(20) NOT NULL,
    CONSTRAINT pk_tutor_authorization_teaching_modes PRIMARY KEY (user_id, teaching_mode),
    CONSTRAINT ck_tutor_authorization_teaching_modes_mode CHECK (teaching_mode IN ('ONLINE', 'OFFLINE'))
);

INSERT INTO tutor_authorization_states (user_id, status, tutor_profile_id, source_event_id, updated_at)
SELECT DISTINCT user_id, 'APPROVED', tutor_profile_id, source_event_id, CURRENT_TIMESTAMP
FROM tutor_subjects
WHERE user_id IS NOT NULL
  AND active = TRUE
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO tutor_authorization_teaching_modes (user_id, teaching_mode)
SELECT user_id, mode
FROM tutor_authorization_states
CROSS JOIN (VALUES ('ONLINE'), ('OFFLINE')) AS modes(mode)
WHERE status = 'APPROVED'
ON CONFLICT (user_id, teaching_mode) DO NOTHING;

CREATE TABLE learning_termination_stop (
    agreement_id VARCHAR(36) PRIMARY KEY,
    classroom_id BIGINT NOT NULL REFERENCES class_rooms(id),
    student_id BIGINT NOT NULL,
    cutoff_session INTEGER NOT NULL,
    closed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX learning_termination_student ON learning_termination_stop(classroom_id, student_id);

CREATE TABLE classroom_materials (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    external_url VARCHAR(1000),
    file_name VARCHAR(255) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_size BIGINT,
    content_type VARCHAR(100),
    uploaded_by_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6)
);

CREATE INDEX idx_classroom_materials_class_room_id ON classroom_materials(class_room_id);
