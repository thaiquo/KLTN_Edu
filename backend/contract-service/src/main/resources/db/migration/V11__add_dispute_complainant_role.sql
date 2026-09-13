ALTER TABLE dispute
    ADD COLUMN IF NOT EXISTS complainant_role VARCHAR(20);

UPDATE dispute
SET complainant_role = 'STUDENT'
WHERE complainant_role IS NULL OR BTRIM(complainant_role) = '';

ALTER TABLE dispute
    ALTER COLUMN complainant_role SET NOT NULL;

ALTER TABLE dispute
    ADD CONSTRAINT ck_dispute_complainant_role
        CHECK (complainant_role IN ('STUDENT', 'TUTOR'));
