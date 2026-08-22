WITH grade_rows AS (
    SELECT registration_id,
           order_index,
           NULLIF(regexp_replace(level_name, '\D', '', 'g'), '') AS grade_number
    FROM tutor_subject_registration_proposed_levels
    WHERE level_code IS NULL
      AND level_type = 'GRADE'
)
UPDATE tutor_subject_registration_proposed_levels proposed_level
SET level_code = 'GRADE_' || grade_rows.grade_number
FROM grade_rows
WHERE proposed_level.registration_id = grade_rows.registration_id
  AND proposed_level.order_index = grade_rows.order_index
  AND grade_rows.grade_number ~ '^(?:[1-9]|1[0-2])$';

UPDATE tutor_subject_registration_proposed_levels proposed_level
SET level_code = 'GRADE_10_ENTRANCE_EXAM'
FROM tutor_subject_registrations registration
JOIN catalog_categories category ON category.id = registration.category_id
LEFT JOIN education_levels education ON education.id = category.education_level_id
WHERE proposed_level.registration_id = registration.id
  AND proposed_level.level_code IS NULL
  AND proposed_level.level_type = 'EXAM_PREPARATION'
  AND (
      education.code = 'SECONDARY'
      OR proposed_level.level_name ILIKE '%lớp 10%'
      OR proposed_level.level_name ILIKE '%lop 10%'
  );

UPDATE tutor_subject_registration_proposed_levels proposed_level
SET level_code = 'NATIONAL_EXAM'
FROM tutor_subject_registrations registration
JOIN catalog_categories category ON category.id = registration.category_id
LEFT JOIN education_levels education ON education.id = category.education_level_id
WHERE proposed_level.registration_id = registration.id
  AND proposed_level.level_code IS NULL
  AND proposed_level.level_type = 'EXAM_PREPARATION'
  AND (
      education.code = 'HIGH_SCHOOL'
      OR proposed_level.level_name ILIKE '%THPT%'
      OR proposed_level.level_name ILIKE '%quốc gia%'
      OR proposed_level.level_name ILIKE '%quoc gia%'
  );

UPDATE tutor_subject_registration_proposed_levels
SET level_code = CASE
    WHEN level_name ILIKE '%năm 1%' OR level_name ILIKE '%nam 1%' THEN 'YEAR_1'
    WHEN level_name ILIKE '%năm 2%' OR level_name ILIKE '%nam 2%' THEN 'YEAR_2'
    WHEN level_name ILIKE '%năm 3%' OR level_name ILIKE '%nam 3%' THEN 'YEAR_3'
    WHEN level_name ILIKE '%năm 4%' OR level_name ILIKE '%nam 4%' OR level_name ILIKE '%4+%' THEN 'YEAR_4_PLUS'
END
WHERE level_code IS NULL
  AND level_type = 'UNIVERSITY_LEVEL'
  AND (
      level_name ILIKE '%năm 1%' OR level_name ILIKE '%nam 1%'
      OR level_name ILIKE '%năm 2%' OR level_name ILIKE '%nam 2%'
      OR level_name ILIKE '%năm 3%' OR level_name ILIKE '%nam 3%'
      OR level_name ILIKE '%năm 4%' OR level_name ILIKE '%nam 4%' OR level_name ILIKE '%4+%'
  );

UPDATE tutor_subject_registration_proposed_levels
SET level_code = CASE
    WHEN level_name ILIKE '%cơ bản%' OR level_name ILIKE '%co ban%' THEN 'BEGINNER'
    WHEN level_name ILIKE '%trung cấp%' OR level_name ILIKE '%trung cap%' THEN 'INTERMEDIATE'
    WHEN level_name ILIKE '%nâng cao%' OR level_name ILIKE '%nang cao%' THEN 'ADVANCED'
END
WHERE level_code IS NULL
  AND level_type = 'SKILL_LEVEL'
  AND (
      level_name ILIKE '%cơ bản%' OR level_name ILIKE '%co ban%'
      OR level_name ILIKE '%trung cấp%' OR level_name ILIKE '%trung cap%'
      OR level_name ILIKE '%nâng cao%' OR level_name ILIKE '%nang cao%'
  );
