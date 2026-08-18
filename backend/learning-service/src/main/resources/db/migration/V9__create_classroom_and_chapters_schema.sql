CREATE TABLE class_rooms (
    id BIGSERIAL PRIMARY KEY,
    tutor_subject_registration_id BIGINT NOT NULL REFERENCES tutor_subject_registrations(id),
    level_id BIGINT NOT NULL REFERENCES catalog_levels(id),
    tutor_email VARCHAR(255) NOT NULL,
    tutor_profile_id BIGINT,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    learning_mode VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    meeting_link VARCHAR(500),
    address VARCHAR(500),
    max_students INTEGER NOT NULL DEFAULT 20,
    price_per_session NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    sessions_per_week INTEGER NOT NULL DEFAULT 3,
    duration_per_session_minutes INTEGER NOT NULL DEFAULT 90,
    duration_value INTEGER NOT NULL DEFAULT 3,
    duration_unit VARCHAR(20) NOT NULL DEFAULT 'MONTH',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_sessions INTEGER NOT NULL,
    syllabus_mode VARCHAR(20) NOT NULL DEFAULT 'FORM',
    syllabus_file_url VARCHAR(1000),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    reject_reason TEXT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_class_room_status CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'CLOSED', 'CANCELLED')),
    CONSTRAINT ck_class_room_learning_mode CHECK (learning_mode IN ('ONLINE', 'OFFLINE')),
    CONSTRAINT ck_class_room_syllabus_mode CHECK (syllabus_mode IN ('FORM', 'FILE', 'BOTH')),
    CONSTRAINT ck_class_room_duration_unit CHECK (duration_unit IN ('WEEK', 'MONTH'))
);

CREATE INDEX idx_class_rooms_tutor ON class_rooms(lower(tutor_email), status);
CREATE INDEX idx_class_rooms_registration ON class_rooms(tutor_subject_registration_id);

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
