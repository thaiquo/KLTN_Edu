CREATE TABLE classrooms (
    id UUID PRIMARY KEY,
    tutor_id UUID NOT NULL,
    teaching_registration_id UUID NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    teaching_level VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_students INTEGER NOT NULL,
    sessions_per_week INTEGER NOT NULL,
    session_duration_minutes INTEGER NOT NULL,
    duration_value INTEGER NOT NULL,
    duration_unit VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    price_per_session NUMERIC(12, 2) NOT NULL,
    total_sessions INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_classrooms_tutor ON classrooms (tutor_id);
CREATE INDEX idx_classrooms_status ON classrooms (status);

CREATE TABLE class_schedules (
    id UUID PRIMARY KEY,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_class_schedules_classroom ON class_schedules (classroom_id);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    date DATE NOT NULL,
    link VARCHAR(1024),
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_sessions_classroom ON sessions (classroom_id);
CREATE INDEX idx_sessions_date ON sessions (date);

CREATE TABLE enrollments (
    id UUID PRIMARY KEY,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    join_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_classroom_student UNIQUE (classroom_id, student_id)
);

CREATE INDEX idx_enrollments_classroom ON enrollments (classroom_id);
