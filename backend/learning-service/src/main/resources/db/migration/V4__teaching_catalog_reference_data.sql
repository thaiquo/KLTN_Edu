INSERT INTO program_types(code, name, description, order_index) VALUES
('ACADEMIC', 'Học thuật / Theo cấp học', 'Chương trình chính quy theo cấp học', 1),
('SKILL', 'Kỹ năng / Chứng chỉ / Nghề nghiệp', 'Kỹ năng, chứng chỉ và nghề nghiệp không phụ thuộc cấp học', 2);

INSERT INTO education_levels(code, name, order_index) VALUES
('PRIMARY', 'Tiểu học', 1),
('SECONDARY', 'THCS', 2),
('HIGH_SCHOOL', 'THPT', 3),
('UNIVERSITY', 'Đại học / Cao đẳng', 4);

INSERT INTO catalog_categories(program_type_id, education_level_id, code, name, order_index)
SELECT pt.id, el.id, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('PRIMARY','PRIMARY_FOUNDATION','Kiến thức nền tảng',1),
    ('SECONDARY','SECONDARY_NATURAL','Khoa học tự nhiên',1),
    ('SECONDARY','SECONDARY_LANGUAGE','Ngôn ngữ',2),
    ('HIGH_SCHOOL','HIGH_SCHOOL_NATURAL','Khoa học tự nhiên',1),
    ('HIGH_SCHOOL','HIGH_SCHOOL_SOCIAL','Khoa học xã hội',2),
    ('HIGH_SCHOOL','HIGH_SCHOOL_LANGUAGE','Ngôn ngữ',3),
    ('UNIVERSITY','UNIVERSITY_IT','Công nghệ thông tin',1),
    ('UNIVERSITY','UNIVERSITY_ECONOMICS','Kinh tế',2)
) AS seed(level_code, code, name, order_index)
JOIN program_types pt ON pt.code='ACADEMIC'
JOIN education_levels el ON el.code=seed.level_code;

INSERT INTO catalog_categories(program_type_id, education_level_id, code, name, order_index)
SELECT pt.id, NULL, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('LANGUAGE_CERT','Ngoại ngữ & Chứng chỉ',1),
    ('IT_TECH','CNTT & Công nghệ',2),
    ('DESIGN','Thiết kế đồ họa',3),
    ('SOFT_SKILL','Kỹ năng mềm',4),
    ('MUSIC','Âm nhạc',5)
) AS seed(code, name, order_index)
JOIN program_types pt ON pt.code='SKILL';

INSERT INTO catalog_subjects(category_id, code, name, order_index)
SELECT c.id, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('HIGH_SCHOOL_NATURAL','MATHEMATICS','Toán',1),
    ('HIGH_SCHOOL_NATURAL','PHYSICS','Vật lý',2),
    ('HIGH_SCHOOL_NATURAL','CHEMISTRY','Hóa học',3),
    ('HIGH_SCHOOL_SOCIAL','LITERATURE','Ngữ văn',1),
    ('HIGH_SCHOOL_LANGUAGE','ENGLISH','Tiếng Anh',1),
    ('UNIVERSITY_IT','PROGRAMMING_C','Lập trình C',1),
    ('LANGUAGE_CERT','TOEIC','TOEIC',1),
    ('LANGUAGE_CERT','IELTS','IELTS',2),
    ('IT_TECH','SPRING_BOOT','Spring Boot',1),
    ('DESIGN','PHOTOSHOP','Adobe Photoshop',1),
    ('MUSIC','GUITAR','Guitar',1)
) AS seed(category_code, code, name, order_index)
JOIN catalog_categories c ON c.code=seed.category_code;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, seed.code, seed.name, seed.level_type, seed.order_index
FROM (VALUES
    ('MATHEMATICS','GRADE_10','Lớp 10','GRADE',1),
    ('MATHEMATICS','GRADE_11','Lớp 11','GRADE',2),
    ('MATHEMATICS','GRADE_12','Lớp 12','GRADE',3),
    ('PHYSICS','GRADE_10','Lớp 10','GRADE',1),
    ('PHYSICS','GRADE_11','Lớp 11','GRADE',2),
    ('PHYSICS','GRADE_12','Lớp 12','GRADE',3),
    ('CHEMISTRY','GRADE_10','Lớp 10','GRADE',1),
    ('CHEMISTRY','GRADE_11','Lớp 11','GRADE',2),
    ('CHEMISTRY','GRADE_12','Lớp 12','GRADE',3),
    ('LITERATURE','GRADE_10','Lớp 10','GRADE',1),
    ('ENGLISH','GRADE_10','Lớp 10','GRADE',1),
    ('PROGRAMMING_C','UNIVERSITY_BEGINNER','Sinh viên năm 1 / Cơ bản','UNIVERSITY_LEVEL',1),
    ('TOEIC','TOEIC_500','TOEIC 500+','CERTIFICATE_TARGET',1),
    ('TOEIC','TOEIC_750','TOEIC 750+','CERTIFICATE_TARGET',2),
    ('IELTS','IELTS_5_5','IELTS 5.5+','CERTIFICATE_TARGET',1),
    ('SPRING_BOOT','BEGINNER','Cơ bản','SKILL_LEVEL',1),
    ('SPRING_BOOT','PROJECT','Project Mentoring','COACHING_LEVEL',2),
    ('PHOTOSHOP','BEGINNER','Cơ bản','SKILL_LEVEL',1),
    ('PHOTOSHOP','RETOUCH','Retouch ảnh','SKILL_LEVEL',2),
    ('GUITAR','BEGINNER','Người mới bắt đầu','SKILL_LEVEL',1),
    ('GUITAR','ACCOMPANIMENT','Guitar đệm hát','SKILL_LEVEL',2)
) AS seed(subject_code, code, name, level_type, order_index)
JOIN catalog_subjects s ON s.code=seed.subject_code;


-- Expand the editable teaching catalog. Flyway runs this migration once, while Admin
-- can continue maintaining the same rows through catalog management APIs.

INSERT INTO catalog_categories(program_type_id, education_level_id, code, name, order_index)
SELECT pt.id, el.id, seed.code, seed.name, seed.order_index
FROM (VALUES
    ('PRIMARY', 'PRIMARY_MATH', 'Toán và tư duy', 1),
    ('PRIMARY', 'PRIMARY_VIETNAMESE', 'Tiếng Việt', 2),
    ('PRIMARY', 'PRIMARY_LANGUAGE', 'Ngoại ngữ', 3),
    ('PRIMARY', 'PRIMARY_SCIENCE', 'Khoa học', 4),
    ('PRIMARY', 'PRIMARY_IT', 'Tin học', 5),
    ('PRIMARY', 'PRIMARY_ARTS', 'Nghệ thuật', 6),
    ('SECONDARY', 'SECONDARY_SOCIAL', 'Khoa học xã hội', 2),
    ('SECONDARY', 'SECONDARY_IT', 'Tin học và Công nghệ', 4),
    ('SECONDARY', 'SECONDARY_ENTRANCE_EXAM', 'Ôn thi chuyển cấp', 5),
    ('HIGH_SCHOOL', 'HIGH_SCHOOL_IT', 'Tin học và Công nghệ', 4),
    ('HIGH_SCHOOL', 'HIGH_SCHOOL_NATIONAL_EXAM', 'Ôn thi THPT Quốc gia', 5),
    ('UNIVERSITY', 'UNIVERSITY_MATH', 'Toán học', 1),
    ('UNIVERSITY', 'UNIVERSITY_ENGINEERING', 'Kỹ thuật', 4),
    ('UNIVERSITY', 'UNIVERSITY_HEALTH', 'Y dược', 5),
    ('UNIVERSITY', 'UNIVERSITY_LANGUAGE', 'Ngoại ngữ', 6),
    ('UNIVERSITY', 'UNIVERSITY_LAW', 'Luật', 7),
    ('UNIVERSITY', 'UNIVERSITY_DESIGN', 'Thiết kế', 8)
) AS seed(level_code, code, name, order_index)
JOIN program_types pt ON pt.code = 'ACADEMIC'
JOIN education_levels el ON el.code = seed.level_code
WHERE NOT EXISTS (SELECT 1 FROM catalog_categories c WHERE c.program_type_id = pt.id AND c.education_level_id = el.id AND c.code = seed.code);

-- The original broad primary category is kept for compatibility but hidden from new selections.
UPDATE catalog_categories SET active = FALSE
WHERE code = 'PRIMARY_FOUNDATION';

INSERT INTO catalog_subjects(category_id, code, name, order_index)
SELECT c.id, seed.subject_code, seed.subject_name, seed.order_index
FROM (VALUES
    ('PRIMARY_MATH','MATHEMATICS','Toán',1), ('PRIMARY_MATH','LOGICAL_THINKING','Tư duy logic',2),
    ('PRIMARY_VIETNAMESE','VIETNAMESE','Tiếng Việt',1), ('PRIMARY_LANGUAGE','ENGLISH','Tiếng Anh',1),
    ('PRIMARY_SCIENCE','SCIENCE','Khoa học',1), ('PRIMARY_SCIENCE','HISTORY_GEOGRAPHY','Lịch sử và Địa lý',2),
    ('PRIMARY_IT','INFORMATICS','Tin học',1), ('PRIMARY_ARTS','MUSIC','Âm nhạc',1), ('PRIMARY_ARTS','FINE_ARTS','Mỹ thuật',2),

    ('SECONDARY_NATURAL','MATHEMATICS','Toán',1), ('SECONDARY_NATURAL','PHYSICS','Vật lý',2),
    ('SECONDARY_NATURAL','CHEMISTRY','Hóa học',3), ('SECONDARY_NATURAL','BIOLOGY','Sinh học',4),
    ('SECONDARY_SOCIAL','LITERATURE','Ngữ văn',1), ('SECONDARY_SOCIAL','HISTORY','Lịch sử',2),
    ('SECONDARY_SOCIAL','GEOGRAPHY','Địa lý',3), ('SECONDARY_SOCIAL','CIVIC_EDUCATION','Giáo dục công dân',4),
    ('SECONDARY_LANGUAGE','ENGLISH','Tiếng Anh',1), ('SECONDARY_IT','INFORMATICS','Tin học',1),
    ('SECONDARY_IT','TECHNOLOGY','Công nghệ',2), ('SECONDARY_ENTRANCE_EXAM','GRADE_10_MATH_EXAM','Ôn thi Toán vào lớp 10',1),
    ('SECONDARY_ENTRANCE_EXAM','GRADE_10_LITERATURE_EXAM','Ôn thi Ngữ văn vào lớp 10',2),
    ('SECONDARY_ENTRANCE_EXAM','GRADE_10_ENGLISH_EXAM','Ôn thi Tiếng Anh vào lớp 10',3),

    ('HIGH_SCHOOL_NATURAL','BIOLOGY','Sinh học',4),
    ('HIGH_SCHOOL_SOCIAL','HISTORY','Lịch sử',2), ('HIGH_SCHOOL_SOCIAL','GEOGRAPHY','Địa lý',3),
    ('HIGH_SCHOOL_SOCIAL','ECONOMIC_LAW_EDUCATION','Giáo dục Kinh tế và Pháp luật',4),
    ('HIGH_SCHOOL_IT','INFORMATICS','Tin học',1), ('HIGH_SCHOOL_IT','TECHNOLOGY','Công nghệ',2),
    ('HIGH_SCHOOL_NATIONAL_EXAM','NATIONAL_MATH_EXAM','Ôn thi THPT Quốc gia môn Toán',1),
    ('HIGH_SCHOOL_NATIONAL_EXAM','NATIONAL_LITERATURE_EXAM','Ôn thi THPT Quốc gia môn Ngữ văn',2),
    ('HIGH_SCHOOL_NATIONAL_EXAM','NATIONAL_ENGLISH_EXAM','Ôn thi THPT Quốc gia môn Tiếng Anh',3),

    ('UNIVERSITY_MATH','CALCULUS','Giải tích',1), ('UNIVERSITY_MATH','LINEAR_ALGEBRA','Đại số tuyến tính',2),
    ('UNIVERSITY_MATH','PROBABILITY_STATISTICS','Xác suất thống kê',3), ('UNIVERSITY_MATH','DISCRETE_MATHEMATICS','Toán rời rạc',4),
    ('UNIVERSITY_IT','CPP','C/C++',2), ('UNIVERSITY_IT','JAVA','Java',3), ('UNIVERSITY_IT','PYTHON','Python',4),
    ('UNIVERSITY_IT','JAVASCRIPT','JavaScript',5), ('UNIVERSITY_IT','TYPESCRIPT','TypeScript',6),
    ('UNIVERSITY_IT','DATA_STRUCTURES_ALGORITHMS','Cấu trúc dữ liệu và Giải thuật',7),
    ('UNIVERSITY_IT','DATABASE_SYSTEMS','Hệ quản trị cơ sở dữ liệu',8), ('UNIVERSITY_IT','OPERATING_SYSTEMS','Hệ điều hành',9),
    ('UNIVERSITY_IT','COMPUTER_NETWORKS','Mạng máy tính',10), ('UNIVERSITY_IT','SOFTWARE_ENGINEERING','Công nghệ phần mềm',11),
    ('UNIVERSITY_IT','WEB_DEVELOPMENT','Phát triển Web',12), ('UNIVERSITY_IT','MOBILE_DEVELOPMENT','Phát triển Mobile',13),
    ('UNIVERSITY_ECONOMICS','ACCOUNTING','Kế toán',1), ('UNIVERSITY_ECONOMICS','FINANCE','Tài chính',2),
    ('UNIVERSITY_ECONOMICS','MARKETING','Marketing',3), ('UNIVERSITY_ECONOMICS','MICROECONOMICS','Kinh tế vi mô',4),
    ('UNIVERSITY_ECONOMICS','MACROECONOMICS','Kinh tế vĩ mô',5), ('UNIVERSITY_ECONOMICS','BUSINESS_ADMINISTRATION','Quản trị kinh doanh',6),
    ('UNIVERSITY_ENGINEERING','ENGINEERING_FOUNDATION','Kiến thức kỹ thuật cơ sở',1),
    ('UNIVERSITY_HEALTH','MEDICAL_FOUNDATION','Kiến thức Y dược cơ sở',1),
    ('UNIVERSITY_LANGUAGE','ACADEMIC_ENGLISH','Tiếng Anh học thuật',1),
    ('UNIVERSITY_LAW','GENERAL_LAW','Pháp luật đại cương',1), ('UNIVERSITY_DESIGN','DESIGN_FOUNDATION','Cơ sở thiết kế',1),

    ('LANGUAGE_CERT','ENGLISH_COMMUNICATION','Tiếng Anh giao tiếp',1), ('LANGUAGE_CERT','ENGLISH_GRAMMAR','Ngữ pháp tiếng Anh',2),
    ('LANGUAGE_CERT','TOEFL','TOEFL',5), ('LANGUAGE_CERT','JLPT','Tiếng Nhật / JLPT',6),
    ('LANGUAGE_CERT','TOPIK','Tiếng Hàn / TOPIK',7), ('LANGUAGE_CERT','HSK','Tiếng Trung / HSK',8),
    ('LANGUAGE_CERT','FRENCH_COMMUNICATION','Tiếng Pháp giao tiếp',9), ('LANGUAGE_CERT','DELF','Luyện thi DELF',10),
    ('IT_TECH','HTML_CSS','HTML/CSS',1), ('IT_TECH','JAVASCRIPT','JavaScript',2), ('IT_TECH','TYPESCRIPT','TypeScript',3),
    ('IT_TECH','REACTJS','ReactJS',4), ('IT_TECH','NEXTJS','NextJS',5), ('IT_TECH','ANGULAR','Angular',6), ('IT_TECH','VUEJS','VueJS',7),
    ('IT_TECH','NODEJS','NodeJS',8), ('IT_TECH','EXPRESSJS','ExpressJS',9), ('IT_TECH','NESTJS','NestJS',10),
    ('IT_TECH','DJANGO','Django',12), ('IT_TECH','FASTAPI','FastAPI',13), ('IT_TECH','LARAVEL','Laravel',14), ('IT_TECH','ASPNET','ASP.NET',15),
    ('IT_TECH','JAVA','Java',16), ('IT_TECH','PYTHON','Python',17), ('IT_TECH','CSHARP','C#',18), ('IT_TECH','CPP','C++',19),
    ('IT_TECH','PHP','PHP',20), ('IT_TECH','GO','Go',21), ('IT_TECH','MYSQL','MySQL',22), ('IT_TECH','POSTGRESQL','PostgreSQL',23),
    ('IT_TECH','MONGODB','MongoDB',24), ('IT_TECH','REDIS','Redis',25), ('IT_TECH','DOCKER','Docker',26),
    ('IT_TECH','KUBERNETES','Kubernetes',27), ('IT_TECH','AWS','AWS',28), ('IT_TECH','AZURE','Azure',29), ('IT_TECH','CICD','CI/CD',30),
    ('IT_TECH','GIT_GITHUB','Git/GitHub',31), ('IT_TECH','SYSTEM_DESIGN','System Design',32), ('IT_TECH','DESIGN_PATTERNS','Design Patterns',33),
    ('DESIGN','FIGMA','Figma',3), ('DESIGN','UI_DESIGN','UI Design',4), ('DESIGN','UX_DESIGN','UX Design',5),
    ('SOFT_SKILL','COMMUNICATION','Kỹ năng giao tiếp',1), ('SOFT_SKILL','PRESENTATION','Kỹ năng thuyết trình',2),
    ('SOFT_SKILL','CRITICAL_THINKING','Tư duy phản biện',3), ('SOFT_SKILL','TEAMWORK','Làm việc nhóm',4),
    ('SOFT_SKILL','TIME_MANAGEMENT','Quản lý thời gian',5), ('SOFT_SKILL','LEADERSHIP','Kỹ năng lãnh đạo',6),
    ('SOFT_SKILL','PROBLEM_SOLVING','Giải quyết vấn đề',7), ('SOFT_SKILL','CV_WRITING','Viết CV',8),
    ('SOFT_SKILL','INTERVIEW_PREPARATION','Chuẩn bị phỏng vấn',9), ('SOFT_SKILL','CAREER_ORIENTATION','Định hướng nghề nghiệp',10),
    ('MUSIC','PIANO','Piano',2), ('MUSIC','VOCAL','Thanh nhạc',3)
) AS seed(category_code, subject_code, subject_name, order_index)
JOIN catalog_categories c ON c.code = seed.category_code
ON CONFLICT (category_id, code) DO NOTHING;

-- Grade levels are generated for every academic subject in the corresponding education level.
INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, 'GRADE', levels.order_index
FROM catalog_subjects s
JOIN catalog_categories c ON c.id = s.category_id
JOIN education_levels el ON el.id = c.education_level_id
JOIN (VALUES ('GRADE_1','Lớp 1',1),('GRADE_2','Lớp 2',2),('GRADE_3','Lớp 3',3),('GRADE_4','Lớp 4',4),('GRADE_5','Lớp 5',5)) levels(code,name,order_index) ON TRUE
WHERE el.code = 'PRIMARY'
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, levels.level_type, levels.order_index
FROM catalog_subjects s
JOIN catalog_categories c ON c.id = s.category_id
JOIN education_levels el ON el.id = c.education_level_id
JOIN (VALUES
    ('GRADE_6','Lớp 6','GRADE',1),('GRADE_7','Lớp 7','GRADE',2),
    ('GRADE_8','Lớp 8','GRADE',3),('GRADE_9','Lớp 9','GRADE',4),
    ('GRADE_10_ENTRANCE_EXAM','Ôn thi vào lớp 10','EXAM_PREPARATION',5)
) levels(code,name,level_type,order_index) ON TRUE
WHERE el.code = 'SECONDARY'
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, levels.level_type, levels.order_index
FROM catalog_subjects s
JOIN catalog_categories c ON c.id = s.category_id
JOIN education_levels el ON el.id = c.education_level_id
JOIN (VALUES
    ('GRADE_10','Lớp 10','GRADE',1),('GRADE_11','Lớp 11','GRADE',2),
    ('GRADE_12','Lớp 12','GRADE',3),('NATIONAL_EXAM','Ôn thi THPT Quốc gia','EXAM_PREPARATION',4)
) levels(code,name,level_type,order_index) ON TRUE
WHERE el.code = 'HIGH_SCHOOL'
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, levels.level_type, levels.order_index
FROM catalog_subjects s
JOIN catalog_categories c ON c.id = s.category_id
JOIN education_levels el ON el.id = c.education_level_id
JOIN (VALUES
    ('YEAR_1','Sinh viên năm 1','UNIVERSITY_LEVEL',1),('YEAR_2','Sinh viên năm 2','UNIVERSITY_LEVEL',2),
    ('YEAR_3','Sinh viên năm 3','UNIVERSITY_LEVEL',3),('YEAR_4_PLUS','Sinh viên năm 4+','UNIVERSITY_LEVEL',4),
    ('THESIS_SUPPORT','Hỗ trợ khóa luận','COACHING_LEVEL',5),('GRADUATION_EXAM','Ôn thi tốt nghiệp','EXAM_PREPARATION',6)
) levels(code,name,level_type,order_index) ON TRUE
WHERE el.code = 'UNIVERSITY'
ON CONFLICT (subject_id, code) DO NOTHING;

-- Skill branches use flexible targets rather than school grades.
INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, levels.level_type, levels.order_index
FROM catalog_subjects s JOIN catalog_categories c ON c.id = s.category_id
JOIN (VALUES
    ('BEGINNER','Cơ bản','SKILL_LEVEL',1),('INTERMEDIATE','Trung cấp','SKILL_LEVEL',2),
    ('ADVANCED','Nâng cao','SKILL_LEVEL',3),('INTERVIEW_PREPARATION','Luyện phỏng vấn','COACHING_LEVEL',4),
    ('PROJECT_MENTORING','Hướng dẫn dự án','COACHING_LEVEL',5)
) levels(code,name,level_type,order_index) ON TRUE
WHERE c.code IN ('IT_TECH','DESIGN')
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, levels.level_type, levels.order_index
FROM catalog_subjects s JOIN catalog_categories c ON c.id = s.category_id
JOIN (VALUES
    ('BEGINNER','Người mới bắt đầu','SKILL_LEVEL',1),('ELEMENTARY','Sơ cấp','SKILL_LEVEL',2),
    ('INTERMEDIATE','Trung cấp','SKILL_LEVEL',3),('UPPER_INTERMEDIATE','Trung cao cấp','SKILL_LEVEL',4),
    ('ADVANCED','Nâng cao','SKILL_LEVEL',5)
) levels(code,name,level_type,order_index) ON TRUE
WHERE c.code = 'LANGUAGE_CERT'
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, levels.level_type, levels.order_index
FROM catalog_subjects s JOIN catalog_categories c ON c.id = s.category_id
JOIN (VALUES
    ('BASIC','Cơ bản','SKILL_LEVEL',1),('ADVANCED','Nâng cao','SKILL_LEVEL',2),
    ('ONE_ON_ONE','Kèm riêng 1-1','COACHING_LEVEL',3)
) levels(code,name,level_type,order_index) ON TRUE
WHERE c.code = 'SOFT_SKILL'
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO catalog_levels(subject_id, code, name, level_type, order_index)
SELECT s.id, levels.code, levels.name, 'SKILL_LEVEL', levels.order_index
FROM catalog_subjects s JOIN catalog_categories c ON c.id = s.category_id
JOIN (VALUES ('BEGINNER','Người mới bắt đầu',1),('INTERMEDIATE','Trung cấp',2),('ADVANCED','Nâng cao',3)) levels(code,name,order_index) ON TRUE
WHERE c.code = 'MUSIC'
ON CONFLICT (subject_id, code) DO NOTHING;


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

