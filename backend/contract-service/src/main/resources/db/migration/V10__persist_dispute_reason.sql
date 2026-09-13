ALTER TABLE dispute
    ADD COLUMN IF NOT EXISTS reason TEXT;

UPDATE dispute
SET reason = type
WHERE reason IS NULL OR BTRIM(reason) = '';

ALTER TABLE dispute
    ALTER COLUMN reason SET NOT NULL;
