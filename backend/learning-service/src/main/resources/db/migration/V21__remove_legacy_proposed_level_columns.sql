-- V18 normalized proposal levels and V19 assigned stable codes. From this
-- version onward the child collection is the only persisted source of truth.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM tutor_subject_registrations registration
        WHERE registration.proposed_subject_name IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM tutor_subject_registration_proposed_levels proposed_level
              WHERE proposed_level.registration_id = registration.id
          )
    ) THEN
        RAISE EXCEPTION 'Cannot remove legacy proposal columns: a proposal has no normalized levels';
    END IF;
END;
$$;

ALTER TABLE tutor_subject_registrations
    DROP CONSTRAINT IF EXISTS ck_registration_proposed_level_type,
    DROP COLUMN proposed_level_name,
    DROP COLUMN proposed_level_type;
