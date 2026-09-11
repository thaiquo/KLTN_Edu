-- Add homework submission columns to session_attendances

ALTER TABLE session_attendances
    ADD COLUMN IF NOT EXISTS submission_text TEXT,
    ADD COLUMN IF NOT EXISTS submission_file_url VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP(6);
