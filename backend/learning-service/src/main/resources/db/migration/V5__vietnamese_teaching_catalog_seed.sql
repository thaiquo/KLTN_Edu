-- Keep catalog display data Vietnamese. Codes stay stable for API logic, import and future admin edits.

UPDATE program_types SET
    name = 'Học thuật / Theo cấp học',
    description = 'Chương trình học chính quy theo Tiểu học, THCS, THPT, Đại học / Cao đẳng',
    order_index = 1,
    active = TRUE
WHERE code = 'ACADEMIC';

UPDATE program_types SET
    name = 'Kỹ năng / Chứng chỉ / Nghề nghiệp',
    description = 'Ngoại ngữ, chứng chỉ, công nghệ, thiết kế, âm nhạc và kỹ năng nghề nghiệp',
    order_index = 2,
    active = TRUE
WHERE code = 'SKILL';

UPDATE education_levels SET name = 'Tiểu học', description = 'Lớp 1 đến lớp 5', order_index = 1, active = TRUE WHERE code = 'PRIMARY';
UPDATE education_levels SET name = 'THCS', description = 'Lớp 6 đến lớp 9', order_index = 2, active = TRUE WHERE code = 'SECONDARY';
UPDATE education_levels SET name = 'THPT', description = 'Lớp 10 đến lớp 12 và ôn thi THPT Quốc gia', order_index = 3, active = TRUE WHERE code = 'HIGH_SCHOOL';
UPDATE education_levels SET name = 'Đại học / Cao đẳng', description = 'Học phần, nền tảng ngành, ôn thi học phần và khóa luận', order_index = 4, active = TRUE WHERE code = 'UNIVERSITY';

UPDATE catalog_categories SET name = 'Toán và tư duy', order_index = 1, active = TRUE WHERE code = 'PRIMARY_MATH';
UPDATE catalog_categories SET name = 'Tiếng Việt', order_index = 2, active = TRUE WHERE code = 'PRIMARY_VIETNAMESE';
UPDATE catalog_categories SET name = 'Ngoại ngữ', order_index = 3, active = TRUE WHERE code = 'PRIMARY_LANGUAGE';
UPDATE catalog_categories SET name = 'Khoa học', order_index = 4, active = TRUE WHERE code = 'PRIMARY_SCIENCE';
UPDATE catalog_categories SET name = 'Tin học', order_index = 5, active = TRUE WHERE code = 'PRIMARY_IT';
UPDATE catalog_categories SET name = 'Nghệ thuật', order_index = 6, active = TRUE WHERE code = 'PRIMARY_ARTS';
UPDATE catalog_categories SET name = 'Khoa học tự nhiên', order_index = 1, active = TRUE WHERE code = 'SECONDARY_NATURAL';
UPDATE catalog_categories SET name = 'Khoa học xã hội', order_index = 2, active = TRUE WHERE code = 'SECONDARY_SOCIAL';
UPDATE catalog_categories SET name = 'Ngôn ngữ', order_index = 3, active = TRUE WHERE code = 'SECONDARY_LANGUAGE';
UPDATE catalog_categories SET name = 'Tin học và Công nghệ', order_index = 4, active = TRUE WHERE code = 'SECONDARY_IT';
UPDATE catalog_categories SET name = 'Ôn thi chuyển cấp', order_index = 5, active = TRUE WHERE code = 'SECONDARY_ENTRANCE_EXAM';
UPDATE catalog_categories SET name = 'Khoa học tự nhiên', order_index = 1, active = TRUE WHERE code = 'HIGH_SCHOOL_NATURAL';
UPDATE catalog_categories SET name = 'Khoa học xã hội', order_index = 2, active = TRUE WHERE code = 'HIGH_SCHOOL_SOCIAL';
UPDATE catalog_categories SET name = 'Ngôn ngữ', order_index = 3, active = TRUE WHERE code = 'HIGH_SCHOOL_LANGUAGE';
UPDATE catalog_categories SET name = 'Tin học và Công nghệ', order_index = 4, active = TRUE WHERE code = 'HIGH_SCHOOL_IT';
UPDATE catalog_categories SET name = 'Ôn thi THPT Quốc gia', order_index = 5, active = TRUE WHERE code = 'HIGH_SCHOOL_NATIONAL_EXAM';
UPDATE catalog_categories SET name = 'Công nghệ thông tin', order_index = 1, active = TRUE WHERE code = 'UNIVERSITY_IT';
UPDATE catalog_categories SET name = 'Toán học', order_index = 2, active = TRUE WHERE code = 'UNIVERSITY_MATH';
UPDATE catalog_categories SET name = 'Kinh tế', order_index = 3, active = TRUE WHERE code = 'UNIVERSITY_ECONOMICS';
UPDATE catalog_categories SET name = 'Kỹ thuật', order_index = 4, active = TRUE WHERE code = 'UNIVERSITY_ENGINEERING';
UPDATE catalog_categories SET name = 'Y dược', order_index = 5, active = TRUE WHERE code = 'UNIVERSITY_HEALTH';
UPDATE catalog_categories SET name = 'Ngoại ngữ', order_index = 6, active = TRUE WHERE code = 'UNIVERSITY_LANGUAGE';
UPDATE catalog_categories SET name = 'Luật', order_index = 7, active = TRUE WHERE code = 'UNIVERSITY_LAW';
UPDATE catalog_categories SET name = 'Thiết kế', order_index = 8, active = TRUE WHERE code = 'UNIVERSITY_DESIGN';
UPDATE catalog_categories SET name = 'Ngoại ngữ và Chứng chỉ', order_index = 1, active = TRUE WHERE code = 'LANGUAGE_CERT';
UPDATE catalog_categories SET name = 'CNTT và Công nghệ', order_index = 2, active = TRUE WHERE code = 'IT_TECH';
UPDATE catalog_categories SET name = 'Thiết kế đồ họa', order_index = 3, active = TRUE WHERE code = 'DESIGN';
UPDATE catalog_categories SET name = 'Kỹ năng mềm', order_index = 4, active = TRUE WHERE code = 'SOFT_SKILL';
UPDATE catalog_categories SET name = 'Âm nhạc', order_index = 5, active = TRUE WHERE code = 'MUSIC';

UPDATE catalog_subjects SET name = 'Lập trình C', order_index = 1, active = TRUE WHERE code = 'PROGRAMMING_C';
UPDATE catalog_subjects SET name = 'Spring Boot', order_index = 11, active = TRUE WHERE code = 'SPRING_BOOT';
UPDATE catalog_subjects SET name = 'Adobe Photoshop', order_index = 1, active = TRUE WHERE code = 'PHOTOSHOP';

INSERT INTO catalog_subjects(category_id, code, name, order_index)
SELECT c.id, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('IELTS', 'IELTS', 3),
    ('TOEIC', 'TOEIC', 4),
    ('TOEFL', 'TOEFL', 5),
    ('JLPT_N5', 'JLPT N5', 6),
    ('JLPT_N4', 'JLPT N4', 7),
    ('JLPT_N3', 'JLPT N3', 8),
    ('JLPT_N2', 'JLPT N2', 9),
    ('JLPT_N1', 'JLPT N1', 10),
    ('TOPIK_I', 'TOPIK I', 11),
    ('TOPIK_II', 'TOPIK II', 12),
    ('HSK_1', 'HSK 1', 13),
    ('HSK_2', 'HSK 2', 14),
    ('HSK_3', 'HSK 3', 15),
    ('HSK_4', 'HSK 4', 16),
    ('HSK_5', 'HSK 5', 17),
    ('HSK_6', 'HSK 6', 18)
) AS seed(code, name, order_index)
JOIN catalog_categories c ON c.code = 'LANGUAGE_CERT'
ON CONFLICT (category_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    order_index = EXCLUDED.order_index,
    active = TRUE;

INSERT INTO catalog_subjects(category_id, code, name, order_index)
SELECT c.id, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('SPRING_BOOT', 'Spring Boot', 11),
    ('FIGMA', 'Figma', 34),
    ('UI_DESIGN', 'Thiết kế UI', 35),
    ('UX_DESIGN', 'Thiết kế UX', 36)
) AS seed(code, name, order_index)
JOIN catalog_categories c ON c.code = 'IT_TECH'
ON CONFLICT (category_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    order_index = EXCLUDED.order_index,
    active = TRUE;

INSERT INTO catalog_subjects(category_id, code, name, order_index)
SELECT c.id, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('BANNER_DESIGN', 'Thiết kế banner', 6),
    ('PHOTO_RETOUCHING', 'Chỉnh sửa ảnh / Retouch', 7),
    ('BRAND_IDENTITY', 'Thiết kế nhận diện thương hiệu', 8)
) AS seed(code, name, order_index)
JOIN catalog_categories c ON c.code = 'DESIGN'
ON CONFLICT (category_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    order_index = EXCLUDED.order_index,
    active = TRUE;

INSERT INTO catalog_subjects(category_id, code, name, order_index)
SELECT c.id, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('GUITAR', 'Guitar', 1),
    ('PIANO', 'Piano', 2),
    ('VOCAL', 'Thanh nhạc', 3)
) AS seed(code, name, order_index)
JOIN catalog_categories c ON c.code = 'MUSIC'
ON CONFLICT (category_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    order_index = EXCLUDED.order_index,
    active = TRUE;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, seed.code, seed.name, seed.level_type, seed.order_index
FROM (VALUES
    ('TOEIC_500', 'TOEIC 500+', 'CERTIFICATE_TARGET', 1),
    ('TOEIC_650', 'TOEIC 650+', 'CERTIFICATE_TARGET', 2),
    ('TOEIC_750', 'TOEIC 750+', 'CERTIFICATE_TARGET', 3),
    ('TOEIC_900', 'TOEIC 900+', 'CERTIFICATE_TARGET', 4)
) AS seed(code, name, level_type, order_index)
JOIN catalog_subjects s ON s.code = 'TOEIC'
JOIN catalog_categories c ON c.id = s.category_id AND c.code = 'LANGUAGE_CERT'
ON CONFLICT (subject_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    level_type = EXCLUDED.level_type,
    order_index = EXCLUDED.order_index,
    active = TRUE;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, seed.code, seed.name, seed.level_type, seed.order_index
FROM (VALUES
    ('IELTS_5_5', 'IELTS 5.5+', 'CERTIFICATE_TARGET', 1),
    ('IELTS_6_5', 'IELTS 6.5+', 'CERTIFICATE_TARGET', 2),
    ('IELTS_7_0', 'IELTS 7.0+', 'CERTIFICATE_TARGET', 3),
    ('IELTS_8_0', 'IELTS 8.0+', 'CERTIFICATE_TARGET', 4)
) AS seed(code, name, level_type, order_index)
JOIN catalog_subjects s ON s.code = 'IELTS'
JOIN catalog_categories c ON c.id = s.category_id AND c.code = 'LANGUAGE_CERT'
ON CONFLICT (subject_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    level_type = EXCLUDED.level_type,
    order_index = EXCLUDED.order_index,
    active = TRUE;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, seed.code, seed.name, seed.level_type, seed.order_index
FROM (VALUES
    ('TARGET_SCORE', 'Mục tiêu chứng chỉ', 'CERTIFICATE_TARGET', 1),
    ('FOUNDATION', 'Nền tảng', 'SKILL_LEVEL', 2),
    ('EXAM_PREPARATION', 'Luyện thi', 'EXAM_PREPARATION', 3)
) AS seed(code, name, level_type, order_index)
JOIN catalog_subjects s ON s.code IN ('TOEFL','JLPT_N5','JLPT_N4','JLPT_N3','JLPT_N2','JLPT_N1','TOPIK_I','TOPIK_II','HSK_1','HSK_2','HSK_3','HSK_4','HSK_5','HSK_6')
JOIN catalog_categories c ON c.id = s.category_id AND c.code = 'LANGUAGE_CERT'
ON CONFLICT (subject_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    level_type = EXCLUDED.level_type,
    order_index = EXCLUDED.order_index,
    active = TRUE;

UPDATE catalog_levels SET name = 'Lớp 1', level_type = 'GRADE', order_index = 1, active = TRUE WHERE code = 'GRADE_1';
UPDATE catalog_levels SET name = 'Lớp 2', level_type = 'GRADE', order_index = 2, active = TRUE WHERE code = 'GRADE_2';
UPDATE catalog_levels SET name = 'Lớp 3', level_type = 'GRADE', order_index = 3, active = TRUE WHERE code = 'GRADE_3';
UPDATE catalog_levels SET name = 'Lớp 4', level_type = 'GRADE', order_index = 4, active = TRUE WHERE code = 'GRADE_4';
UPDATE catalog_levels SET name = 'Lớp 5', level_type = 'GRADE', order_index = 5, active = TRUE WHERE code = 'GRADE_5';
UPDATE catalog_levels SET name = 'Lớp 6', level_type = 'GRADE', order_index = 1, active = TRUE WHERE code = 'GRADE_6';
UPDATE catalog_levels SET name = 'Lớp 7', level_type = 'GRADE', order_index = 2, active = TRUE WHERE code = 'GRADE_7';
UPDATE catalog_levels SET name = 'Lớp 8', level_type = 'GRADE', order_index = 3, active = TRUE WHERE code = 'GRADE_8';
UPDATE catalog_levels SET name = 'Lớp 9', level_type = 'GRADE', order_index = 4, active = TRUE WHERE code = 'GRADE_9';
UPDATE catalog_levels SET name = 'Ôn thi vào lớp 10', level_type = 'EXAM_PREPARATION', order_index = 5, active = TRUE WHERE code = 'GRADE_10_ENTRANCE_EXAM';
UPDATE catalog_levels SET name = 'Lớp 10', level_type = 'GRADE', order_index = 1, active = TRUE WHERE code = 'GRADE_10';
UPDATE catalog_levels SET name = 'Lớp 11', level_type = 'GRADE', order_index = 2, active = TRUE WHERE code = 'GRADE_11';
UPDATE catalog_levels SET name = 'Lớp 12', level_type = 'GRADE', order_index = 3, active = TRUE WHERE code = 'GRADE_12';
UPDATE catalog_levels SET name = 'Ôn thi THPT Quốc gia', level_type = 'EXAM_PREPARATION', order_index = 4, active = TRUE WHERE code = 'NATIONAL_EXAM';
UPDATE catalog_levels SET name = 'Sinh viên năm 1', level_type = 'UNIVERSITY_LEVEL', order_index = 1, active = TRUE WHERE code = 'YEAR_1';
UPDATE catalog_levels SET name = 'Sinh viên năm 2', level_type = 'UNIVERSITY_LEVEL', order_index = 2, active = TRUE WHERE code = 'YEAR_2';
UPDATE catalog_levels SET name = 'Sinh viên năm 3', level_type = 'UNIVERSITY_LEVEL', order_index = 3, active = TRUE WHERE code = 'YEAR_3';
UPDATE catalog_levels SET name = 'Sinh viên năm 4+', level_type = 'UNIVERSITY_LEVEL', order_index = 4, active = TRUE WHERE code = 'YEAR_4_PLUS';
UPDATE catalog_levels SET name = 'Hỗ trợ khóa luận', level_type = 'COACHING_LEVEL', order_index = 5, active = TRUE WHERE code = 'THESIS_SUPPORT';
UPDATE catalog_levels SET name = 'Ôn thi tốt nghiệp', level_type = 'EXAM_PREPARATION', order_index = 6, active = TRUE WHERE code = 'GRADUATION_EXAM';
UPDATE catalog_levels SET name = 'Cơ bản', level_type = 'SKILL_LEVEL', order_index = 1, active = TRUE WHERE code IN ('BEGINNER','BASIC');
UPDATE catalog_levels SET name = 'Sinh viên năm 1 / Cơ bản', level_type = 'UNIVERSITY_LEVEL', order_index = 1, active = TRUE WHERE code = 'UNIVERSITY_BEGINNER';
UPDATE catalog_levels SET name = 'Trung cấp', level_type = 'SKILL_LEVEL', order_index = 2, active = TRUE WHERE code = 'INTERMEDIATE';
UPDATE catalog_levels SET name = 'Nâng cao', level_type = 'SKILL_LEVEL', order_index = 3, active = TRUE WHERE code = 'ADVANCED';
UPDATE catalog_levels SET name = 'Luyện phỏng vấn', level_type = 'COACHING_LEVEL', order_index = 4, active = TRUE WHERE code = 'INTERVIEW_PREPARATION';
UPDATE catalog_levels SET name = 'Hướng dẫn dự án', level_type = 'COACHING_LEVEL', order_index = 5, active = TRUE WHERE code IN ('PROJECT','PROJECT_MENTORING');
UPDATE catalog_levels SET name = 'Người mới bắt đầu', level_type = 'SKILL_LEVEL', order_index = 1, active = TRUE WHERE code = 'ELEMENTARY';
UPDATE catalog_levels SET name = 'Trung cao cấp', level_type = 'SKILL_LEVEL', order_index = 4, active = TRUE WHERE code = 'UPPER_INTERMEDIATE';
UPDATE catalog_levels SET name = 'Kèm riêng 1-1', level_type = 'COACHING_LEVEL', order_index = 3, active = TRUE WHERE code = 'ONE_ON_ONE';
UPDATE catalog_levels SET name = 'Guitar đệm hát', level_type = 'SKILL_LEVEL', order_index = 2, active = TRUE WHERE code = 'ACCOMPANIMENT';
UPDATE catalog_levels SET name = 'Retouch ảnh', level_type = 'SKILL_LEVEL', order_index = 2, active = TRUE WHERE code = 'RETOUCH';
