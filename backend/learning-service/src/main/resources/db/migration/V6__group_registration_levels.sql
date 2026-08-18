CREATE TABLE tutor_subject_registration_levels (
    registration_id BIGINT NOT NULL
        REFERENCES tutor_subject_registrations(id) ON DELETE CASCADE,
    level_id BIGINT NOT NULL
        REFERENCES catalog_levels(id),
    CONSTRAINT pk_tutor_subject_registration_levels
        PRIMARY KEY (registration_id, level_id)
);

INSERT INTO tutor_subject_registration_levels(registration_id, level_id)
SELECT id, level_id
FROM tutor_subject_registrations;

-- Earlier batch submissions created one registration per level. Merge rows that
-- were submitted together and retain every selected level under one registration.
CREATE TEMP TABLE registration_merge_map ON COMMIT DROP AS
SELECT
    id AS source_id,
    MIN(id) OVER (
        PARTITION BY lower(tutor_email), subject_id, status, experience_years,
                     tuition_min, tuition_max, description,
                     date_trunc('minute', submitted_at)
    ) AS target_id
FROM tutor_subject_registrations;

INSERT INTO tutor_subject_registration_levels(registration_id, level_id)
SELECT merge.target_id, registration_level.level_id
FROM registration_merge_map merge
JOIN tutor_subject_registration_levels registration_level
  ON registration_level.registration_id = merge.source_id
WHERE merge.source_id <> merge.target_id
ON CONFLICT DO NOTHING;

INSERT INTO registration_evidence(
    registration_id, account_document_id, evidence_type, title, file_url, created_at
)
SELECT
    merge.target_id,
    evidence.account_document_id,
    evidence.evidence_type,
    evidence.title,
    evidence.file_url,
    evidence.created_at
FROM registration_merge_map merge
JOIN registration_evidence evidence ON evidence.registration_id = merge.source_id
WHERE merge.source_id <> merge.target_id
  AND NOT EXISTS (
      SELECT 1
      FROM registration_evidence existing
      WHERE existing.registration_id = merge.target_id
        AND existing.account_document_id IS NOT DISTINCT FROM evidence.account_document_id
        AND existing.evidence_type = evidence.evidence_type
        AND existing.title = evidence.title
        AND existing.file_url IS NOT DISTINCT FROM evidence.file_url
  );

DELETE FROM tutor_subject_registrations registration
USING registration_merge_map merge
WHERE registration.id = merge.source_id
  AND merge.source_id <> merge.target_id;

DROP INDEX uk_active_tutor_subject_registration;
ALTER TABLE tutor_subject_registrations DROP COLUMN level_id;

CREATE INDEX idx_registration_levels_level
    ON tutor_subject_registration_levels(level_id, registration_id);

CREATE INDEX idx_tutor_registrations_subject_status
    ON tutor_subject_registrations(lower(tutor_email), subject_id, status);
