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
