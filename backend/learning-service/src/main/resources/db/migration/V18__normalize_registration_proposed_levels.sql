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

CREATE INDEX idx_registration_proposed_levels_registration
    ON tutor_subject_registration_proposed_levels(registration_id);

INSERT INTO tutor_subject_registration_proposed_levels(
    registration_id, order_index, level_code, level_name, level_type
)
SELECT registration.id,
       split_level.ordinality - 1,
       NULL,
       BTRIM(split_level.level_name),
       registration.proposed_level_type
FROM tutor_subject_registrations registration
CROSS JOIN LATERAL regexp_split_to_table(registration.proposed_level_name, '\s*,\s*')
    WITH ORDINALITY AS split_level(level_name, ordinality)
WHERE registration.proposed_subject_name IS NOT NULL
  AND registration.proposed_level_name IS NOT NULL
  AND registration.proposed_level_type = 'GRADE'
  AND BTRIM(split_level.level_name) <> '';

INSERT INTO tutor_subject_registration_proposed_levels(
    registration_id, order_index, level_code, level_name, level_type
)
SELECT registration.id, 0, NULL, BTRIM(registration.proposed_level_name), registration.proposed_level_type
FROM tutor_subject_registrations registration
WHERE registration.proposed_subject_name IS NOT NULL
  AND registration.proposed_level_name IS NOT NULL
  AND registration.proposed_level_type <> 'GRADE'
  AND BTRIM(registration.proposed_level_name) <> '';
