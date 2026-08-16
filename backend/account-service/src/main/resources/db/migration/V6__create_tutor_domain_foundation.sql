CREATE TABLE tutor_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    bio TEXT,
    education_level VARCHAR(120),
    institution VARCHAR(255),
    major VARCHAR(160),
    experience_summary VARCHAR(1000),
    submitted_at TIMESTAMP(6),
    reviewed_at TIMESTAMP(6),
    reviewed_by BIGINT,
    rejection_reason VARCHAR(1000),
    review_note VARCHAR(1000),
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_tutor_applications_user
        FOREIGN KEY (user_id)
        REFERENCES users (id),
    CONSTRAINT fk_tutor_applications_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES users (id),
    CONSTRAINT ck_tutor_applications_status
        CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX idx_tutor_applications_user_id
    ON tutor_applications (user_id);

CREATE INDEX idx_tutor_applications_status
    ON tutor_applications (status);

CREATE TABLE tutor_application_subjects (
    id BIGSERIAL PRIMARY KEY,
    tutor_application_id BIGINT NOT NULL,
    subject_id BIGINT NOT NULL,
    subject_name VARCHAR(160) NOT NULL,
    subject_category_name VARCHAR(120),
    subject_group_name VARCHAR(140),
    one_to_one_hourly_rate NUMERIC(12, 2) NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0,
    description VARCHAR(1000),
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_tutor_application_subjects_application
        FOREIGN KEY (tutor_application_id)
        REFERENCES tutor_applications (id)
        ON DELETE CASCADE,
    CONSTRAINT uk_tutor_application_subjects_application_subject
        UNIQUE (tutor_application_id, subject_id),
    CONSTRAINT ck_tutor_application_subjects_rate
        CHECK (one_to_one_hourly_rate > 0),
    CONSTRAINT ck_tutor_application_subjects_experience_years
        CHECK (experience_years >= 0)
);

CREATE INDEX idx_tutor_application_subjects_application_id
    ON tutor_application_subjects (tutor_application_id);

CREATE INDEX idx_tutor_application_subjects_subject_id
    ON tutor_application_subjects (subject_id);

CREATE TABLE tutor_application_subject_levels (
    tutor_application_subject_id BIGINT NOT NULL,
    level VARCHAR(40) NOT NULL,
    CONSTRAINT pk_tutor_application_subject_levels
        PRIMARY KEY (tutor_application_subject_id, level),
    CONSTRAINT fk_tutor_application_subject_levels_subject
        FOREIGN KEY (tutor_application_subject_id)
        REFERENCES tutor_application_subjects (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_tutor_application_subject_levels_level
        CHECK (level IN ('PRIMARY', 'LOWER_SECONDARY', 'UPPER_SECONDARY', 'UNIVERSITY', 'ADULT', 'EXAM_PREPARATION'))
);

CREATE TABLE tutor_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    bio TEXT,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_tutor_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
);

CREATE INDEX idx_tutor_profiles_user_id
    ON tutor_profiles (user_id);
