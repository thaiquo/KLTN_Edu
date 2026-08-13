CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6)
);

CREATE TABLE user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES users (id),
    CONSTRAINT uk_user_roles_user_role
        UNIQUE (user_id, role)
);

CREATE TABLE otp_verifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    otp VARCHAR(10) NOT NULL,
    type VARCHAR(30) NOT NULL,
    expired_at TIMESTAMP(6) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_otp_verifications_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
);

CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    grade VARCHAR(50),
    learning_goal TEXT,
    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
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
    CONSTRAINT ck_subject_levels_level
        CHECK (level IN ('PRIMARY', 'LOWER_SECONDARY', 'UPPER_SECONDARY', 'UNIVERSITY', 'ADULT', 'EXAM_PREPARATION'))
);

CREATE TABLE tutors (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    bio TEXT,
    education TEXT,
    experience_years INTEGER,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_tutors_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
);

CREATE TABLE tutor_subjects (
    tutor_id BIGINT NOT NULL,
    subject_id BIGINT NOT NULL,
    CONSTRAINT pk_tutor_subjects
        PRIMARY KEY (tutor_id, subject_id),
    CONSTRAINT fk_tutor_subjects_tutor
        FOREIGN KEY (tutor_id)
        REFERENCES tutors (id),
    CONSTRAINT fk_tutor_subjects_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects (id)
);

CREATE INDEX idx_otp_verifications_user_type_created_at
    ON otp_verifications (user_id, type, created_at DESC);

CREATE INDEX idx_subjects_category_id
    ON subjects (category_id);

CREATE INDEX idx_subjects_group_id
    ON subjects (group_id);

CREATE INDEX idx_subject_groups_category_id
    ON subject_groups (category_id);

CREATE INDEX idx_subject_levels_level
    ON subject_levels (level);
