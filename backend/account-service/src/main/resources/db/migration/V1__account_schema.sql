CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    avatar_key VARCHAR(512),
    avatar_sha256 VARCHAR(64),
    gender VARCHAR(30),
    province_code VARCHAR(30),
    province VARCHAR(100),
    commune_code VARCHAR(40),
    commune VARCHAR(160),
    district VARCHAR(100),
    ward VARCHAR(100),
    address_detail VARCHAR(255),
    bio VARCHAR(300),
    wallet_address VARCHAR(42),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6)
);

CREATE UNIQUE INDEX uk_users_email_lower
    ON users (LOWER(email));

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
    invalidated BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_otp_verifications_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
);

CREATE INDEX idx_otp_verifications_user_type_created_at
    ON otp_verifications (user_id, type, created_at DESC);

CREATE INDEX idx_otp_verifications_active_lookup
    ON otp_verifications (user_id, type, verified, invalidated, created_at DESC);

CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    grade VARCHAR(50),
    learning_goal TEXT,
    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
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
    applicant_full_name VARCHAR(100),
    applicant_email VARCHAR(255),
    applicant_phone VARCHAR(20),
    applicant_date_of_birth DATE,
    applicant_gender VARCHAR(30),
    applicant_province_code VARCHAR(30),
    applicant_province_name VARCHAR(120),
    applicant_commune_code VARCHAR(40),
    applicant_commune_name VARCHAR(160),
    applicant_address_detail VARCHAR(255),
    applicant_avatar_key VARCHAR(512),
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

CREATE TABLE tutor_application_teaching_modes (
    tutor_application_id BIGINT NOT NULL,
    teaching_mode VARCHAR(20) NOT NULL,
    CONSTRAINT pk_tutor_application_teaching_modes
        PRIMARY KEY (tutor_application_id, teaching_mode),
    CONSTRAINT fk_tutor_application_teaching_modes_application
        FOREIGN KEY (tutor_application_id)
        REFERENCES tutor_applications (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_tutor_application_teaching_modes_mode
        CHECK (teaching_mode IN ('ONLINE', 'OFFLINE'))
);

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

CREATE TABLE tutor_documents (
    id BIGSERIAL PRIMARY KEY,
    tutor_application_id BIGINT NOT NULL,
    document_type VARCHAR(40) NOT NULL,
    file_key VARCHAR(500) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    file_size BIGINT NOT NULL,
    sha256_hash VARCHAR(64),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    uploaded_at TIMESTAMP(6) NOT NULL,
    title VARCHAR(160),
    issuer VARCHAR(160),
    issue_date DATE,
    validity_type VARCHAR(30),
    expiry_date DATE,
    credential_number VARCHAR(120),
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_tutor_documents_application
        FOREIGN KEY (tutor_application_id)
        REFERENCES tutor_applications (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_tutor_documents_type
        CHECK (document_type IN (
            'IDENTITY_FRONT',
            'IDENTITY_BACK',
            'PASSPORT',
            'DEGREE',
            'CERTIFICATE',
            'WORK_EXPERIENCE',
            'PORTFOLIO',
            'OTHER'
        )),
    CONSTRAINT ck_tutor_documents_verification_status
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    CONSTRAINT ck_tutor_documents_validity_type
        CHECK (validity_type IS NULL OR validity_type IN ('EXPIRES', 'DOES_NOT_EXPIRE')),
    CONSTRAINT ck_tutor_documents_expiry
        CHECK (
            validity_type IS NULL
            OR validity_type = 'DOES_NOT_EXPIRE'
            OR expiry_date IS NOT NULL
        ),
    CONSTRAINT ck_tutor_documents_file_size
        CHECK (file_size > 0)
);

CREATE INDEX idx_tutor_documents_application_id
    ON tutor_documents (tutor_application_id);

CREATE INDEX idx_tutor_documents_application_status
    ON tutor_documents (tutor_application_id, verification_status);

CREATE INDEX idx_tutor_documents_app_sha256
    ON tutor_documents(tutor_application_id, sha256_hash);

CREATE TABLE administrative_provinces (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE administrative_communes (
    code VARCHAR(40) PRIMARY KEY,
    province_code VARCHAR(30) NOT NULL,
    name VARCHAR(160) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_administrative_communes_province
        FOREIGN KEY (province_code)
        REFERENCES administrative_provinces (code),
    CONSTRAINT uk_administrative_communes_province_name
        UNIQUE (province_code, name)
);

CREATE INDEX idx_administrative_communes_province
    ON administrative_communes (province_code);

CREATE TABLE refresh_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    active_role VARCHAR(20) NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP,
    replaced_by_token_id BIGINT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_refresh_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_sessions_replaced_by
        FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_sessions(id),
    CONSTRAINT uk_refresh_sessions_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_sessions_user_revoked
    ON refresh_sessions (user_id, revoked);

CREATE INDEX idx_refresh_sessions_expires_at
    ON refresh_sessions (expires_at);
