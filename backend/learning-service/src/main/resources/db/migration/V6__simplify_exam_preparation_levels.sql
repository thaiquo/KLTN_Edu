-- Exam preparation is already scoped by education level and category. Keep one
-- selectable target per subject instead of repeating every school grade.
UPDATE catalog_categories
SET name = 'Ôn thi vào lớp 10',
    description = 'Ôn thi chuyển cấp từ THCS vào lớp 10',
    active = TRUE
WHERE code = 'SECONDARY_ENTRANCE_EXAM';

UPDATE catalog_categories
SET name = 'Ôn thi tốt nghiệp THPT Quốc gia',
    description = 'Ôn thi tốt nghiệp THPT Quốc gia theo từng môn',
    active = TRUE
WHERE code = 'HIGH_SCHOOL_NATIONAL_EXAM';

UPDATE catalog_subjects subject
SET name = CASE subject.code
        WHEN 'GRADE_10_MATH_EXAM' THEN 'Toán'
        WHEN 'GRADE_10_LITERATURE_EXAM' THEN 'Ngữ văn'
        WHEN 'GRADE_10_ENGLISH_EXAM' THEN 'Tiếng Anh'
        ELSE subject.name
    END,
    active = TRUE
FROM catalog_categories category
WHERE subject.category_id = category.id
  AND category.code = 'SECONDARY_ENTRANCE_EXAM';

UPDATE catalog_subjects subject
SET name = CASE subject.code
        WHEN 'NATIONAL_MATH_EXAM' THEN 'Toán'
        WHEN 'NATIONAL_LITERATURE_EXAM' THEN 'Ngữ văn'
        WHEN 'NATIONAL_ENGLISH_EXAM' THEN 'Tiếng Anh'
        ELSE subject.name
    END,
    active = TRUE
FROM catalog_categories category
WHERE subject.category_id = category.id
  AND category.code = 'HIGH_SCHOOL_NATIONAL_EXAM';

UPDATE catalog_levels level
SET name = CASE
        WHEN level.code = 'GRADE_10_ENTRANCE_EXAM' THEN 'Ôn thi vào lớp 10'
        ELSE level.name
    END,
    level_type = CASE
        WHEN level.code = 'GRADE_10_ENTRANCE_EXAM' THEN 'EXAM_PREPARATION'
        ELSE level.level_type
    END,
    order_index = CASE
        WHEN level.code = 'GRADE_10_ENTRANCE_EXAM' THEN 1
        ELSE level.order_index
    END,
    active = (level.code = 'GRADE_10_ENTRANCE_EXAM')
FROM catalog_subjects subject
JOIN catalog_categories category ON category.id = subject.category_id
WHERE level.subject_id = subject.id
  AND category.code = 'SECONDARY_ENTRANCE_EXAM';

UPDATE catalog_levels level
SET name = CASE
        WHEN level.code = 'NATIONAL_EXAM' THEN 'Ôn thi tốt nghiệp THPT Quốc gia'
        ELSE level.name
    END,
    level_type = CASE
        WHEN level.code = 'NATIONAL_EXAM' THEN 'EXAM_PREPARATION'
        ELSE level.level_type
    END,
    order_index = CASE
        WHEN level.code = 'NATIONAL_EXAM' THEN 1
        ELSE level.order_index
    END,
    active = (level.code = 'NATIONAL_EXAM')
FROM catalog_subjects subject
JOIN catalog_categories category ON category.id = subject.category_id
WHERE level.subject_id = subject.id
  AND category.code = 'HIGH_SCHOOL_NATIONAL_EXAM';
