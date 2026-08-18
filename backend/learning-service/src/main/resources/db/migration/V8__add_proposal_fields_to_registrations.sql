-- ==========================================
-- ADD PROPOSAL FIELDS TO TUTOR REGISTRATIONS
-- ==========================================

-- Allow subject_id to be NULL for registrations representing new subject proposals
ALTER TABLE tutor_subject_registrations ALTER COLUMN subject_id DROP NOT NULL;

-- Add fields for the proposed subject and level
ALTER TABLE tutor_subject_registrations ADD COLUMN proposed_subject_name VARCHAR(160) NULL;
ALTER TABLE tutor_subject_registrations ADD COLUMN proposed_level_name VARCHAR(160) NULL;
ALTER TABLE tutor_subject_registrations ADD COLUMN proposed_level_type VARCHAR(40) NULL;
ALTER TABLE tutor_subject_registrations ADD COLUMN proposed_note VARCHAR(1000) NULL;

-- Add check constraint for the proposed level type to maintain integrity
ALTER TABLE tutor_subject_registrations ADD CONSTRAINT ck_registration_proposed_level_type CHECK (
    proposed_level_type IS NULL OR proposed_level_type IN (
        'GRADE', 'EXAM_PREPARATION', 'UNIVERSITY_LEVEL',
        'CERTIFICATE_TARGET', 'SKILL_LEVEL', 'COACHING_LEVEL'
    )
);
