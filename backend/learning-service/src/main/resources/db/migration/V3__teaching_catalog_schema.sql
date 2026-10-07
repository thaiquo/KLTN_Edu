CREATE TABLE program_types (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE education_levels (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE catalog_categories (
    id BIGSERIAL PRIMARY KEY,
    program_type_id BIGINT NOT NULL REFERENCES program_types(id),
    education_level_id BIGINT REFERENCES education_levels(id),
    code VARCHAR(60) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_catalog_category_scope UNIQUE(program_type_id, education_level_id, code)
);

CREATE TABLE catalog_subjects (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES catalog_categories(id),
    code VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT uk_catalog_subject_category_code UNIQUE(category_id, code),
    CONSTRAINT uk_catalog_subject_category_name UNIQUE(category_id, name)
);

CREATE TABLE catalog_levels (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL REFERENCES catalog_subjects(id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    level_type VARCHAR(40) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_catalog_level_subject_code UNIQUE(subject_id, code),
    CONSTRAINT ck_catalog_level_type CHECK (level_type IN (
        'GRADE', 'EXAM_PREPARATION', 'UNIVERSITY_LEVEL',
        'CERTIFICATE_TARGET', 'SKILL_LEVEL', 'COACHING_LEVEL'
    ))
);

CREATE TABLE tutor_subject_registrations (
    id BIGSERIAL PRIMARY KEY,
    tutor_email VARCHAR(255) NOT NULL,
    tutor_profile_id BIGINT,
    program_type_id BIGINT NOT NULL REFERENCES program_types(id),
    education_level_id BIGINT REFERENCES education_levels(id),
    category_id BIGINT NOT NULL REFERENCES catalog_categories(id),
    subject_id BIGINT REFERENCES catalog_subjects(id),
    proposed_subject_name VARCHAR(160),
    proposed_note VARCHAR(1000),
    experience_years INTEGER NOT NULL DEFAULT 0,
    tuition_min NUMERIC(12,2) NOT NULL,
    tuition_max NUMERIC(12,2) NOT NULL,
    description VARCHAR(1500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reject_reason VARCHAR(1000),
    review_note VARCHAR(1000),
    submitted_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP(6),
    reviewed_by_email VARCHAR(255),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_registration_status CHECK (status IN ('DRAFT','PENDING','APPROVED','REJECTED','SUSPENDED')),
    CONSTRAINT ck_registration_experience CHECK (experience_years BETWEEN 0 AND 60),
    CONSTRAINT ck_registration_tuition CHECK (tuition_min > 0 AND tuition_max >= tuition_min)
);

CREATE TABLE tutor_subject_registration_levels (
    registration_id BIGINT NOT NULL REFERENCES tutor_subject_registrations(id) ON DELETE CASCADE,
    level_id BIGINT NOT NULL REFERENCES catalog_levels(id),
    CONSTRAINT pk_tutor_subject_registration_levels PRIMARY KEY (registration_id, level_id)
);

CREATE TABLE tutor_subject_registration_proposed_levels (
    registration_id BIGINT NOT NULL REFERENCES tutor_subject_registrations(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    level_code VARCHAR(80),
    level_name VARCHAR(160) NOT NULL,
    level_type VARCHAR(40) NOT NULL,
    PRIMARY KEY (registration_id, order_index),
    CONSTRAINT ck_registration_proposed_level_type CHECK (level_type IN (
        'GRADE', 'EXAM_PREPARATION', 'UNIVERSITY_LEVEL',
        'CERTIFICATE_TARGET', 'SKILL_LEVEL', 'COACHING_LEVEL'
    ))
);

CREATE TABLE registration_evidence (
    id BIGSERIAL PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES tutor_subject_registrations(id) ON DELETE CASCADE,
    account_document_id BIGINT,
    evidence_type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    file_url VARCHAR(1000),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_registration_evidence_type CHECK (evidence_type IN (
        'DEGREE','CERTIFICATE','TRANSCRIPT','PORTFOLIO','VIDEO','GITHUB_PROJECT','WORK_EXPERIENCE','OTHER'
    )),
    CONSTRAINT ck_registration_evidence_source CHECK (account_document_id IS NOT NULL OR file_url IS NOT NULL)
);

CREATE TABLE catalog_import_jobs (
    id BIGSERIAL PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_rows INTEGER NOT NULL DEFAULT 0,
    success_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    error_report TEXT,
    created_by_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP(6),
    CONSTRAINT ck_catalog_import_status CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','PARTIAL'))
);

CREATE TABLE catalog_subject_suggestions (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES catalog_categories(id),
    suggested_subject_name VARCHAR(160) NOT NULL,
    suggested_level_name VARCHAR(160) NOT NULL,
    suggested_level_type VARCHAR(40) NOT NULL,
    note VARCHAR(1000),
    requested_by_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by_email VARCHAR(255),
    reviewed_at TIMESTAMP(6),
    reject_reason VARCHAR(1000),
    approved_subject_id BIGINT REFERENCES catalog_subjects(id),
    approved_level_id BIGINT REFERENCES catalog_levels(id),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_catalog_suggestion_status CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    CONSTRAINT ck_catalog_suggestion_level_type CHECK (suggested_level_type IN (
        'GRADE','EXAM_PREPARATION','UNIVERSITY_LEVEL','CERTIFICATE_TARGET','SKILL_LEVEL','COACHING_LEVEL'
    ))
);

CREATE INDEX idx_catalog_categories_scope ON catalog_categories(program_type_id, education_level_id, active, order_index);
CREATE INDEX idx_catalog_subjects_category ON catalog_subjects(category_id, active, order_index);
CREATE INDEX idx_catalog_levels_subject ON catalog_levels(subject_id, active, order_index);
CREATE INDEX idx_tutor_registrations_owner ON tutor_subject_registrations(lower(tutor_email), status, submitted_at);
CREATE INDEX idx_tutor_registrations_review ON tutor_subject_registrations(status, submitted_at);
CREATE INDEX idx_tutor_registrations_subject_status ON tutor_subject_registrations(lower(tutor_email), subject_id, status);
CREATE INDEX idx_registration_levels_level ON tutor_subject_registration_levels(level_id, registration_id);
CREATE INDEX idx_registration_proposed_levels_registration ON tutor_subject_registration_proposed_levels(registration_id);
CREATE INDEX idx_catalog_suggestions_review ON catalog_subject_suggestions(status, created_at);

-- Keep the normalized teaching catalog internally consistent even when data is
-- imported or maintained outside the application service layer.

CREATE UNIQUE INDEX IF NOT EXISTS uk_catalog_category_academic_code_ci
    ON catalog_categories(program_type_id, education_level_id, lower(code))
    WHERE education_level_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_catalog_category_skill_code_ci
    ON catalog_categories(program_type_id, lower(code))
    WHERE education_level_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_catalog_subject_category_code_ci
    ON catalog_subjects(category_id, lower(code));

CREATE UNIQUE INDEX IF NOT EXISTS uk_catalog_level_subject_code_ci
    ON catalog_levels(subject_id, lower(code));

ALTER TABLE tutor_subject_registrations
    ADD CONSTRAINT ck_registration_subject_or_proposal
    CHECK (subject_id IS NOT NULL OR proposed_subject_name IS NOT NULL);

CREATE OR REPLACE FUNCTION validate_catalog_category_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    program_code VARCHAR(30);
BEGIN
    SELECT code INTO program_code FROM program_types WHERE id = NEW.program_type_id;
    IF program_code = 'ACADEMIC' AND NEW.education_level_id IS NULL THEN
        RAISE EXCEPTION 'Academic catalog category requires an education level';
    END IF;
    IF program_code = 'SKILL' AND NEW.education_level_id IS NOT NULL THEN
        RAISE EXCEPTION 'Skill catalog category must not have an education level';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_catalog_category_branch
BEFORE INSERT OR UPDATE OF program_type_id, education_level_id
ON catalog_categories
FOR EACH ROW EXECUTE FUNCTION validate_catalog_category_branch();

CREATE OR REPLACE FUNCTION validate_registration_catalog_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    category_program_type_id BIGINT;
    category_education_level_id BIGINT;
    subject_category_id BIGINT;
BEGIN
    SELECT program_type_id, education_level_id
      INTO category_program_type_id, category_education_level_id
      FROM catalog_categories
     WHERE id = NEW.category_id;

    IF NEW.program_type_id IS DISTINCT FROM category_program_type_id
       OR NEW.education_level_id IS DISTINCT FROM category_education_level_id THEN
        RAISE EXCEPTION 'Registration program and education level must match its category';
    END IF;

    IF NEW.subject_id IS NOT NULL THEN
        SELECT category_id INTO subject_category_id FROM catalog_subjects WHERE id = NEW.subject_id;
        IF subject_category_id IS DISTINCT FROM NEW.category_id THEN
            RAISE EXCEPTION 'Registration subject must belong to its category';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registration_catalog_scope
BEFORE INSERT OR UPDATE OF program_type_id, education_level_id, category_id, subject_id
ON tutor_subject_registrations
FOR EACH ROW EXECUTE FUNCTION validate_registration_catalog_scope();

CREATE OR REPLACE FUNCTION validate_registration_level_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    registration_subject_id BIGINT;
    registration_tutor_email VARCHAR(255);
    registration_status VARCHAR(20);
    level_subject_id BIGINT;
BEGIN
    SELECT subject_id, tutor_email, status
      INTO registration_subject_id, registration_tutor_email, registration_status
      FROM tutor_subject_registrations
     WHERE id = NEW.registration_id;
    SELECT subject_id INTO level_subject_id FROM catalog_levels WHERE id = NEW.level_id;

    IF registration_subject_id IS NULL OR level_subject_id IS DISTINCT FROM registration_subject_id THEN
        RAISE EXCEPTION 'Registration level must belong to the registration subject';
    END IF;

    IF registration_status IN ('DRAFT', 'PENDING', 'APPROVED') THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(lower(registration_tutor_email) || ':' || registration_subject_id, 0));
        IF EXISTS (
            SELECT 1
              FROM tutor_subject_registration_levels existing_level
              JOIN tutor_subject_registrations existing_registration
                ON existing_registration.id = existing_level.registration_id
             WHERE existing_level.level_id = NEW.level_id
               AND existing_registration.id <> NEW.registration_id
               AND lower(existing_registration.tutor_email) = lower(registration_tutor_email)
               AND existing_registration.subject_id = registration_subject_id
               AND existing_registration.status IN ('DRAFT', 'PENDING', 'APPROVED')
        ) THEN
            RAISE EXCEPTION 'Tutor already has an active registration for this subject and level';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_registration_level_scope
BEFORE INSERT OR UPDATE OF registration_id, level_id
ON tutor_subject_registration_levels
FOR EACH ROW EXECUTE FUNCTION validate_registration_level_scope();

COMMENT ON TABLE subjects IS 'Legacy V1 catalog. New teaching flows must use catalog_subjects.';
COMMENT ON TABLE subject_requests IS 'Legacy V1 proposal flow. New proposals are stored with tutor_subject_registrations.';
COMMENT ON TABLE catalog_subject_suggestions IS 'Deprecated standalone proposal flow retained temporarily for data compatibility.';

