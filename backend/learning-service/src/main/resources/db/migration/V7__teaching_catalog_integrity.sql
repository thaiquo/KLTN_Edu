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
