-- Preserve completed history and audit; open absence warnings must synchronize
-- their operational hold before the service assigns a fresh response deadline.
UPDATE termination_case
SET origin = 'AUTO_TUTOR_ABSENCE',
    status = CASE WHEN status IN ('REQUESTED', 'RECOMMENDED') THEN 'HOLD_PENDING' ELSE status END,
    updated_at = CURRENT_TIMESTAMP
WHERE origin = 'PARTY_REQUEST' AND detection_key LIKE 'TUTOR_ABSENT:%';

UPDATE termination_case
SET origin = 'SYSTEM_REVIEW'
WHERE origin = 'PARTY_REQUEST' AND detection_key LIKE 'UPHELD_COMPLAINT:%';
