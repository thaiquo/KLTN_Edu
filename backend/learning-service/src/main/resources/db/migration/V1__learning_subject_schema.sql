CREATE TABLE teaching_levels (
    code VARCHAR(40) PRIMARY KEY,
    display_name VARCHAR(80) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE subject_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE subject_groups (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL,
    name VARCHAR(140) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_subject_groups_category
        FOREIGN KEY (category_id)
        REFERENCES subject_categories (id),
    CONSTRAINT uk_subject_groups_category_name
        UNIQUE (category_id, name)
);

CREATE TABLE subjects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category_id BIGINT NOT NULL,
    group_id BIGINT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_subjects_category
        FOREIGN KEY (category_id)
        REFERENCES subject_categories (id),
    CONSTRAINT fk_subjects_group
        FOREIGN KEY (group_id)
        REFERENCES subject_groups (id),
    CONSTRAINT uk_subjects_name_category
        UNIQUE (name, category_id)
);

CREATE TABLE subject_levels (
    subject_id BIGINT NOT NULL,
    level VARCHAR(40) NOT NULL,
    CONSTRAINT pk_subject_levels
        PRIMARY KEY (subject_id, level),
    CONSTRAINT fk_subject_levels_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_subject_levels_level
        FOREIGN KEY (level)
        REFERENCES teaching_levels (code)
);

CREATE TABLE subject_requests (
    id BIGSERIAL PRIMARY KEY,
    requested_name VARCHAR(160) NOT NULL,
    category_id BIGINT NOT NULL,
    group_id BIGINT,
    requested_by_user_id BIGINT NOT NULL,
    note VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by_user_id BIGINT,
    reviewed_at TIMESTAMP(6),
    reject_reason VARCHAR(1000),
    approved_subject_id BIGINT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_subject_requests_category
        FOREIGN KEY (category_id)
        REFERENCES subject_categories (id),
    CONSTRAINT fk_subject_requests_group
        FOREIGN KEY (group_id)
        REFERENCES subject_groups (id),
    CONSTRAINT fk_subject_requests_approved_subject
        FOREIGN KEY (approved_subject_id)
        REFERENCES subjects (id),
    CONSTRAINT ck_subject_requests_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE TABLE subject_request_levels (
    subject_request_id BIGINT NOT NULL,
    level VARCHAR(40) NOT NULL,
    CONSTRAINT pk_subject_request_levels
        PRIMARY KEY (subject_request_id, level),
    CONSTRAINT fk_subject_request_levels_request
        FOREIGN KEY (subject_request_id)
        REFERENCES subject_requests (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_subject_request_levels_level
        FOREIGN KEY (level)
        REFERENCES teaching_levels (code)
);

CREATE TABLE tutor_subjects (
    id BIGSERIAL PRIMARY KEY,
    tutor_profile_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    subject_id BIGINT NOT NULL,
    one_to_one_hourly_rate NUMERIC(12, 2) NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0,
    description VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source_event_id VARCHAR(80),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_tutor_subjects_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects (id),
    CONSTRAINT uk_tutor_subjects_profile_subject
        UNIQUE (tutor_profile_id, subject_id)
);

CREATE TABLE tutor_subject_levels (
    tutor_subject_id BIGINT NOT NULL,
    level VARCHAR(40) NOT NULL,
    CONSTRAINT pk_tutor_subject_levels
        PRIMARY KEY (tutor_subject_id, level),
    CONSTRAINT fk_tutor_subject_levels_subject
        FOREIGN KEY (tutor_subject_id)
        REFERENCES tutor_subjects (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tutor_subject_levels_level
        FOREIGN KEY (level)
        REFERENCES teaching_levels (code)
);

CREATE TABLE processed_events (
    event_id VARCHAR(80) PRIMARY KEY,
    event_type VARCHAR(120) NOT NULL,
    processed_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subjects_category_id ON subjects (category_id);
CREATE INDEX idx_subjects_group_id ON subjects (group_id);
CREATE INDEX idx_subject_groups_category_id ON subject_groups (category_id);
CREATE INDEX idx_subject_levels_level ON subject_levels (level);
CREATE INDEX idx_teaching_levels_active ON teaching_levels (active);
CREATE INDEX idx_subject_requests_status ON subject_requests (status);
CREATE INDEX idx_subject_requests_user ON subject_requests (requested_by_user_id);
CREATE INDEX idx_tutor_subjects_user ON tutor_subjects (user_id);
