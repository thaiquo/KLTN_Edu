-- DEVELOPMENT-ONLY LEARNING SEEDS. Not loaded by Flyway db/migration.
-- Loaded by DevelopmentDataLoader only when the Spring "dev" profile is active.
-- Run account-service dev data first because this seed maps tutors by account users/tutors.

INSERT INTO tutor_authorization_states (user_id, status, tutor_profile_id, source_event_id, updated_at)
SELECT app_user.id, 'APPROVED', tutor.id, 'dev-dataset-v1:' || LOWER(app_user.email), CURRENT_TIMESTAMP
FROM users app_user
JOIN tutors tutor ON tutor.user_id = app_user.id
WHERE LOWER(app_user.email) IN (
    'tutor1@gmail.com', 'tutor2@gmail.com', 'tutor3@gmail.com', 'tutor4@gmail.com', 'tutor5@gmail.com',
    'tutor6@gmail.com', 'tutor7@gmail.com', 'tutor8@gmail.com', 'tutor9@gmail.com', 'tutor10@gmail.com',
    'tutor11@gmail.com', 'tutor12@gmail.com', 'tutor13@gmail.com', 'tutor14@gmail.com', 'tutor15@gmail.com',
    'tutor16@gmail.com', 'tutor17@gmail.com', 'tutor18@gmail.com', 'tutor19@gmail.com', 'tutor20@gmail.com',
    'tutor21@gmail.com', 'tutor22@gmail.com', 'tutor23@gmail.com', 'tutor24@gmail.com', 'tutor25@gmail.com',
    'tutor26@gmail.com', 'tutor27@gmail.com', 'tutor28@gmail.com', 'tutor29@gmail.com', 'tutor30@gmail.com'
)
ON CONFLICT (user_id) DO UPDATE SET
    status = 'APPROVED',
    tutor_profile_id = EXCLUDED.tutor_profile_id,
    source_event_id = EXCLUDED.source_event_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO tutor_authorization_teaching_modes (user_id, teaching_mode)
SELECT auth_state.user_id, mode
FROM users app_user
JOIN tutor_authorization_states auth_state ON auth_state.user_id = app_user.id
CROSS JOIN (VALUES ('ONLINE'), ('OFFLINE')) AS modes(mode)
WHERE LOWER(app_user.email) IN (
    'tutor1@gmail.com', 'tutor2@gmail.com', 'tutor3@gmail.com', 'tutor4@gmail.com', 'tutor5@gmail.com',
    'tutor6@gmail.com', 'tutor7@gmail.com', 'tutor8@gmail.com', 'tutor9@gmail.com', 'tutor10@gmail.com',
    'tutor11@gmail.com', 'tutor12@gmail.com', 'tutor13@gmail.com', 'tutor14@gmail.com', 'tutor15@gmail.com',
    'tutor16@gmail.com', 'tutor17@gmail.com', 'tutor18@gmail.com', 'tutor19@gmail.com', 'tutor20@gmail.com',
    'tutor21@gmail.com', 'tutor22@gmail.com', 'tutor23@gmail.com', 'tutor24@gmail.com', 'tutor25@gmail.com',
    'tutor26@gmail.com', 'tutor27@gmail.com', 'tutor28@gmail.com', 'tutor29@gmail.com', 'tutor30@gmail.com'
)
ON CONFLICT (user_id, teaching_mode) DO NOTHING;

WITH registration_seed(email, category_code, subject_code, experience_years, tuition_min, tuition_max, description) AS (
    VALUES
        ('tutor1@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 5, 180000, 250000, 'Củng cố Toán THPT, ôn tập theo chuyên đề và bài kiểm tra ngắn.'),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 4, 160000, 220000, 'Kèm Toán THPT với cách trình bày lời giải rõ ràng.'),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 4, 180000, 220000, 'Vật lý THPT theo hiện tượng, công thức và dạng bài cơ bản.'),
        ('tutor3@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 7, 250000, 350000, 'Ôn thi THPT Quốc gia môn Toán theo lộ trình nâng cao.'),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 3, 140000, 200000, 'Lấy lại gốc Toán và rèn bài tập trên lớp.'),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 3, 150000, 200000, 'Hóa học THPT, tập trung phương trình và bài tập tính toán.'),
        ('tutor5@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 6, 200000, 280000, 'Vật lý THPT theo sơ đồ công thức và bài mẫu.'),
        ('tutor6@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 5, 180000, 250000, 'Hóa học theo chuyên đề, nhận diện lỗi sai và luyện bài tăng dần.'),
        ('tutor7@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 4, 180000, 260000, 'Ngữ pháp và giao tiếp tiếng Anh cho học sinh phổ thông.'),
        ('tutor8@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 5, 200000, 260000, 'Tiếng Anh ứng dụng kết hợp luyện nghe nói và từ vựng.'),
        ('tutor8@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 5, 240000, 300000, 'TOEIC nghe đọc theo mục tiêu điểm và bộ đề ngắn.'),
        ('tutor9@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 6, 250000, 350000, 'Luyện TOEIC theo chiến lược làm bài và canh thời gian.'),
        ('tutor10@gmail.com', 'LANGUAGE_CERT', 'IELTS', 7, 330000, 450000, 'IELTS writing và speaking với feedback chi tiết theo rubric.'),
        ('tutor10@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 7, 300000, 380000, 'Academic English cho học sinh THPT và học vien cần nền tảng.'),
        ('tutor11@gmail.com', 'LANGUAGE_CERT', 'IELTS', 4, 280000, 380000, 'IELTS foundation đến band mục tiêu, có bài sửa hằng tuần.'),
        ('tutor12@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 3, 140000, 200000, 'Tiếng Anh cơ bản cho học sinh phổ thông cần tự tin hơn.'),
        ('tutor13@gmail.com', 'IT_TECH', 'JAVA', 5, 220000, 320000, 'Java core, OOP và mini project có review code.'),
        ('tutor14@gmail.com', 'IT_TECH', 'JAVA', 4, 250000, 320000, 'Java backend nền tảng, debug và thực hành API.'),
        ('tutor14@gmail.com', 'IT_TECH', 'SPRING_BOOT', 4, 280000, 350000, 'Spring Boot REST API, validation và kết nối database.'),
        ('tutor15@gmail.com', 'IT_TECH', 'JAVA', 7, 300000, 380000, 'Java backend thực chiến cho sinh viên làm project.'),
        ('tutor15@gmail.com', 'IT_TECH', 'SPRING_BOOT', 7, 330000, 400000, 'Spring Boot project mentoring và kiến trúc service.'),
        ('tutor15@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 7, 300000, 380000, 'SQL, quan hệ dữ liệu và thiết kế schema cho backend.'),
        ('tutor16@gmail.com', 'IT_TECH', 'PYTHON', 4, 200000, 280000, 'Python cơ bản đến xử lý dữ liệu nhỏ và automation đơn giản.'),
        ('tutor17@gmail.com', 'IT_TECH', 'PYTHON', 6, 250000, 330000, 'Python cho data exercise và bài tập thực hành.'),
        ('tutor17@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 6, 260000, 330000, 'SQL query, join, aggregation và tối ưu câu lệnh cơ bản.'),
        ('tutor18@gmail.com', 'IT_TECH', 'REACTJS', 4, 220000, 300000, 'React component, hooks, routing và kết nối API.'),
        ('tutor19@gmail.com', 'IT_TECH', 'REACTJS', 5, 250000, 350000, 'React state management, UX và refactor code frontend.'),
        ('tutor20@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 8, 260000, 360000, 'SQL, index và thiết kế database cho ứng dụng.'),
        ('tutor21@gmail.com', 'IT_TECH', 'JAVA', 2, 150000, 210000, 'Java cơ bản cho sinh viên năm đầu.'),
        ('tutor21@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 2, 160000, 220000, 'SQL nền tảng cho bài tập trên lớp và mini app.'),
        ('tutor22@gmail.com', 'IT_TECH', 'PYTHON', 2, 140000, 200000, 'Python cho người mới bắt đầu, thực hành từng bước.'),
        ('tutor23@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 8, 160000, 230000, 'Toán phổ thông, phương pháp giải nhanh và ôn thi.'),
        ('tutor24@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 2, 130000, 190000, 'Hóa học nền tảng, bài tập vừa sức và ghi nhớ có logic.'),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 10, 320000, 420000, 'Vật lý nâng cao cho học sinh mục tiêu cao.'),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 10, 300000, 400000, 'Toán nâng cao, ôn thi và luyện bài phân loại.'),
        ('tutor26@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 3, 190000, 250000, 'TOEIC theo lộ trình ngắn gọn, theo dõi tiến bộ từng tuần.'),
        ('tutor26@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 3, 180000, 230000, 'Tiếng Anh giao tiếp và ngữ pháp căn bản.'),
        ('tutor27@gmail.com', 'LANGUAGE_CERT', 'IELTS', 5, 280000, 380000, 'IELTS mục tiêu 6.5+ với bài tập cá nhân hóa.'),
        ('tutor27@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 5, 260000, 340000, 'TOEIC 650+ và 750+ theo chiến lược nghe đọc.'),
        ('tutor28@gmail.com', 'IT_TECH', 'SPRING_BOOT', 6, 300000, 380000, 'Spring Boot API và project backend theo sprint nhỏ.'),
        ('tutor28@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 6, 280000, 360000, 'SQL cho ứng dụng Java backend và tối ưu truy vấn.'),
        ('tutor29@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 2, 120000, 180000, 'Tiếng Anh nền tảng cho học sinh cần lấy lại gốc.'),
        ('tutor30@gmail.com', 'IT_TECH', 'JAVA', 3, 200000, 270000, 'Java cơ bản, OOP và bài tập thực hành.'),
        ('tutor30@gmail.com', 'IT_TECH', 'PYTHON', 3, 210000, 280000, 'Python cơ bản và bài tập thực hành theo buổi.')
),
resolved_registration AS (
    SELECT
        seed.*,
        app_user.id AS user_id,
        tutor.id AS tutor_profile_id,
        subject.id AS subject_id,
        category.id AS category_id,
        category.program_type_id,
        category.education_level_id
    FROM registration_seed seed
    JOIN users app_user ON LOWER(app_user.email) = seed.email
    JOIN tutors tutor ON tutor.user_id = app_user.id
    JOIN catalog_categories category ON category.code = seed.category_code AND category.active = TRUE
    JOIN catalog_subjects subject ON subject.category_id = category.id AND subject.code = seed.subject_code AND subject.active = TRUE
)
INSERT INTO tutor_subject_registrations (
    tutor_email, tutor_profile_id, program_type_id, education_level_id, category_id, subject_id,
    experience_years, tuition_min, tuition_max, description, status,
    submitted_at, reviewed_at, reviewed_by_email, review_note, created_at, updated_at
)
SELECT
    email,
    tutor_profile_id,
    program_type_id,
    education_level_id,
    category_id,
    subject_id,
    experience_years,
    tuition_min,
    tuition_max,
    description,
    'APPROVED',
    TIMESTAMP '2026-08-26 09:00:00',
    TIMESTAMP '2026-08-27 10:00:00',
    'ngocquocthai.004@gmail.com',
    'Approved development dataset teaching registration.',
    TIMESTAMP '2026-08-26 09:00:00',
    CURRENT_TIMESTAMP
FROM resolved_registration seed
WHERE NOT EXISTS (
    SELECT 1
    FROM tutor_subject_registrations existing
    WHERE LOWER(existing.tutor_email) = seed.email
      AND existing.tutor_profile_id = seed.tutor_profile_id
      AND existing.subject_id = seed.subject_id
      AND existing.status <> 'SUSPENDED'
);

WITH registration_seed(email, category_code, subject_code, level_codes) AS (
    VALUES
        ('tutor1@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', ARRAY['GRADE_12','NATIONAL_EXAM']),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', ARRAY['GRADE_10','GRADE_11','GRADE_12']),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', ARRAY['GRADE_10','GRADE_11','GRADE_12']),
        ('tutor3@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', ARRAY['GRADE_12','NATIONAL_EXAM']),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', ARRAY['GRADE_10','GRADE_11']),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', ARRAY['GRADE_10','GRADE_11']),
        ('tutor5@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', ARRAY['GRADE_11','GRADE_12','NATIONAL_EXAM']),
        ('tutor6@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', ARRAY['GRADE_10','GRADE_11','GRADE_12']),
        ('tutor7@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', ARRAY['GRADE_10','GRADE_11','GRADE_12']),
        ('tutor8@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', ARRAY['GRADE_10','GRADE_11','GRADE_12']),
        ('tutor8@gmail.com', 'LANGUAGE_CERT', 'TOEIC', ARRAY['TOEIC_500','TOEIC_650','TOEIC_750']),
        ('tutor9@gmail.com', 'LANGUAGE_CERT', 'TOEIC', ARRAY['TOEIC_650','TOEIC_750','TOEIC_900']),
        ('tutor10@gmail.com', 'LANGUAGE_CERT', 'IELTS', ARRAY['IELTS_6_5','IELTS_7_0','IELTS_8_0']),
        ('tutor10@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', ARRAY['GRADE_11','GRADE_12']),
        ('tutor11@gmail.com', 'LANGUAGE_CERT', 'IELTS', ARRAY['IELTS_5_5','IELTS_6_5']),
        ('tutor12@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', ARRAY['GRADE_10','GRADE_11']),
        ('tutor13@gmail.com', 'IT_TECH', 'JAVA', ARRAY['BEGINNER','INTERMEDIATE','PROJECT_MENTORING']),
        ('tutor14@gmail.com', 'IT_TECH', 'JAVA', ARRAY['BEGINNER','INTERMEDIATE']),
        ('tutor14@gmail.com', 'IT_TECH', 'SPRING_BOOT', ARRAY['BEGINNER','PROJECT_MENTORING']),
        ('tutor15@gmail.com', 'IT_TECH', 'JAVA', ARRAY['INTERMEDIATE','ADVANCED','PROJECT_MENTORING']),
        ('tutor15@gmail.com', 'IT_TECH', 'SPRING_BOOT', ARRAY['INTERMEDIATE','PROJECT_MENTORING']),
        ('tutor15@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', ARRAY['YEAR_2','YEAR_3','YEAR_4_PLUS']),
        ('tutor16@gmail.com', 'IT_TECH', 'PYTHON', ARRAY['BEGINNER','INTERMEDIATE']),
        ('tutor17@gmail.com', 'IT_TECH', 'PYTHON', ARRAY['INTERMEDIATE','ADVANCED']),
        ('tutor17@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', ARRAY['YEAR_2','YEAR_3']),
        ('tutor18@gmail.com', 'IT_TECH', 'REACTJS', ARRAY['BEGINNER','INTERMEDIATE','PROJECT_MENTORING']),
        ('tutor19@gmail.com', 'IT_TECH', 'REACTJS', ARRAY['INTERMEDIATE','ADVANCED','PROJECT_MENTORING']),
        ('tutor20@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', ARRAY['YEAR_2','YEAR_3','YEAR_4_PLUS']),
        ('tutor21@gmail.com', 'IT_TECH', 'JAVA', ARRAY['BEGINNER','INTERMEDIATE']),
        ('tutor21@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', ARRAY['YEAR_1','YEAR_2']),
        ('tutor22@gmail.com', 'IT_TECH', 'PYTHON', ARRAY['BEGINNER']),
        ('tutor23@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', ARRAY['GRADE_10','GRADE_11','GRADE_12','NATIONAL_EXAM']),
        ('tutor24@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', ARRAY['GRADE_10','GRADE_11']),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', ARRAY['GRADE_12','NATIONAL_EXAM']),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', ARRAY['GRADE_12','NATIONAL_EXAM']),
        ('tutor26@gmail.com', 'LANGUAGE_CERT', 'TOEIC', ARRAY['TOEIC_500','TOEIC_650','TOEIC_750']),
        ('tutor26@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', ARRAY['GRADE_10','GRADE_11','GRADE_12']),
        ('tutor27@gmail.com', 'LANGUAGE_CERT', 'IELTS', ARRAY['IELTS_6_5','IELTS_7_0']),
        ('tutor27@gmail.com', 'LANGUAGE_CERT', 'TOEIC', ARRAY['TOEIC_650','TOEIC_750']),
        ('tutor28@gmail.com', 'IT_TECH', 'SPRING_BOOT', ARRAY['INTERMEDIATE','PROJECT_MENTORING']),
        ('tutor28@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', ARRAY['YEAR_2','YEAR_3','YEAR_4_PLUS']),
        ('tutor29@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', ARRAY['GRADE_10','GRADE_11']),
        ('tutor30@gmail.com', 'IT_TECH', 'JAVA', ARRAY['BEGINNER','INTERMEDIATE']),
        ('tutor30@gmail.com', 'IT_TECH', 'PYTHON', ARRAY['BEGINNER','INTERMEDIATE'])
),
resolved_registration AS (
    SELECT
        seed.email,
        subject.id AS subject_id,
        UNNEST(seed.level_codes) AS level_code
    FROM registration_seed seed
    JOIN catalog_categories category ON category.code = seed.category_code AND category.active = TRUE
    JOIN catalog_subjects subject ON subject.category_id = category.id AND subject.code = seed.subject_code AND subject.active = TRUE
),
matched_registration AS (
    SELECT
        registration.id AS registration_id,
        level.id AS level_id
    FROM resolved_registration seed
    JOIN tutor_subject_registrations registration ON LOWER(registration.tutor_email) = seed.email
    JOIN catalog_levels level ON level.subject_id = seed.subject_id AND level.code = seed.level_code AND level.active = TRUE
    WHERE registration.subject_id = seed.subject_id
      AND registration.status = 'APPROVED'
)
INSERT INTO tutor_subject_registration_levels (registration_id, level_id)
SELECT registration_id, level_id
FROM matched_registration
ON CONFLICT (registration_id, level_id) DO NOTHING;

DELETE FROM tutor_availabilities
WHERE LOWER(tutor_email) IN (
    'tutor1@gmail.com', 'tutor2@gmail.com', 'tutor3@gmail.com', 'tutor4@gmail.com', 'tutor5@gmail.com',
    'tutor6@gmail.com', 'tutor7@gmail.com', 'tutor8@gmail.com', 'tutor9@gmail.com', 'tutor10@gmail.com',
    'tutor11@gmail.com', 'tutor12@gmail.com', 'tutor13@gmail.com', 'tutor14@gmail.com', 'tutor15@gmail.com',
    'tutor16@gmail.com', 'tutor17@gmail.com', 'tutor18@gmail.com', 'tutor19@gmail.com', 'tutor20@gmail.com',
    'tutor21@gmail.com', 'tutor22@gmail.com', 'tutor23@gmail.com', 'tutor24@gmail.com', 'tutor25@gmail.com',
    'tutor26@gmail.com', 'tutor27@gmail.com', 'tutor28@gmail.com', 'tutor29@gmail.com', 'tutor30@gmail.com'
);

WITH availability_seed(email, day_of_week, start_time, end_time) AS (
    VALUES
        ('tutor1@gmail.com', 2, '18:30', '21:30'), ('tutor1@gmail.com', 4, '18:30', '21:30'), ('tutor1@gmail.com', 6, '18:30', '21:30'),
        ('tutor2@gmail.com', 3, '18:00', '21:00'), ('tutor2@gmail.com', 5, '18:00', '21:00'), ('tutor2@gmail.com', 7, '18:30', '21:30'),
        ('tutor3@gmail.com', 2, '18:30', '21:30'), ('tutor3@gmail.com', 4, '18:30', '21:30'),
        ('tutor4@gmail.com', 2, '13:30', '17:00'), ('tutor4@gmail.com', 3, '13:30', '17:00'), ('tutor4@gmail.com', 4, '13:30', '17:00'), ('tutor4@gmail.com', 5, '13:30', '17:00'), ('tutor4@gmail.com', 6, '13:30', '17:00'),
        ('tutor5@gmail.com', 3, '18:00', '21:00'), ('tutor5@gmail.com', 5, '18:00', '21:00'), ('tutor5@gmail.com', 8, '08:30', '11:30'),
        ('tutor6@gmail.com', 2, '18:30', '21:30'), ('tutor6@gmail.com', 4, '18:30', '21:30'), ('tutor6@gmail.com', 6, '18:30', '21:30'),
        ('tutor7@gmail.com', 2, '18:00', '21:00'), ('tutor7@gmail.com', 3, '18:00', '21:00'), ('tutor7@gmail.com', 5, '18:00', '21:00'),
        ('tutor8@gmail.com', 4, '18:30', '21:30'), ('tutor8@gmail.com', 6, '18:30', '21:30'), ('tutor8@gmail.com', 7, '09:00', '11:30'),
        ('tutor9@gmail.com', 3, '18:30', '21:30'), ('tutor9@gmail.com', 5, '18:30', '21:30'), ('tutor9@gmail.com', 7, '18:00', '21:00'),
        ('tutor10@gmail.com', 2, '18:30', '21:30'), ('tutor10@gmail.com', 4, '18:30', '21:30'), ('tutor10@gmail.com', 6, '18:30', '21:30'),
        ('tutor11@gmail.com', 3, '18:00', '21:00'), ('tutor11@gmail.com', 5, '18:00', '21:00'), ('tutor11@gmail.com', 8, '09:00', '11:30'),
        ('tutor12@gmail.com', 2, '13:30', '17:00'), ('tutor12@gmail.com', 3, '13:30', '17:00'), ('tutor12@gmail.com', 4, '13:30', '17:00'), ('tutor12@gmail.com', 5, '13:30', '17:00'), ('tutor12@gmail.com', 6, '13:30', '17:00'),
        ('tutor13@gmail.com', 2, '18:30', '21:30'), ('tutor13@gmail.com', 4, '18:30', '21:30'), ('tutor13@gmail.com', 6, '18:30', '21:30'),
        ('tutor14@gmail.com', 3, '18:30', '21:30'), ('tutor14@gmail.com', 5, '18:30', '21:30'), ('tutor14@gmail.com', 7, '09:00', '12:00'),
        ('tutor15@gmail.com', 2, '18:00', '21:00'), ('tutor15@gmail.com', 4, '18:00', '21:00'),
        ('tutor16@gmail.com', 3, '18:30', '21:30'), ('tutor16@gmail.com', 5, '18:30', '21:30'), ('tutor16@gmail.com', 7, '18:00', '21:00'),
        ('tutor17@gmail.com', 2, '18:30', '21:30'), ('tutor17@gmail.com', 4, '18:30', '21:30'), ('tutor17@gmail.com', 6, '18:30', '21:30'),
        ('tutor18@gmail.com', 3, '18:30', '21:30'), ('tutor18@gmail.com', 5, '18:30', '21:30'),
        ('tutor19@gmail.com', 2, '18:30', '21:30'), ('tutor19@gmail.com', 4, '18:30', '21:30'), ('tutor19@gmail.com', 8, '09:00', '11:30'),
        ('tutor20@gmail.com', 6, '18:30', '21:30'), ('tutor20@gmail.com', 7, '09:00', '12:00'), ('tutor20@gmail.com', 8, '09:00', '12:00'),
        ('tutor21@gmail.com', 2, '18:30', '21:30'), ('tutor21@gmail.com', 3, '18:30', '21:30'), ('tutor21@gmail.com', 4, '18:30', '21:30'), ('tutor21@gmail.com', 5, '18:30', '21:30'), ('tutor21@gmail.com', 6, '18:30', '21:30'),
        ('tutor22@gmail.com', 2, '13:30', '17:00'), ('tutor22@gmail.com', 4, '13:30', '17:00'), ('tutor22@gmail.com', 6, '13:30', '17:00'),
        ('tutor23@gmail.com', 2, '18:00', '21:00'), ('tutor23@gmail.com', 3, '18:00', '21:00'), ('tutor23@gmail.com', 4, '18:00', '21:00'), ('tutor23@gmail.com', 5, '18:00', '21:00'), ('tutor23@gmail.com', 6, '18:00', '21:00'),
        ('tutor24@gmail.com', 3, '18:30', '21:30'), ('tutor24@gmail.com', 5, '18:30', '21:30'),
        ('tutor25@gmail.com', 7, '08:30', '12:00'), ('tutor25@gmail.com', 8, '08:30', '12:00'),
        ('tutor26@gmail.com', 2, '18:00', '21:00'), ('tutor26@gmail.com', 4, '18:00', '21:00'), ('tutor26@gmail.com', 6, '18:00', '21:00'),
        ('tutor27@gmail.com', 3, '18:30', '21:30'), ('tutor27@gmail.com', 5, '18:30', '21:30'), ('tutor27@gmail.com', 7, '18:00', '21:00'),
        ('tutor28@gmail.com', 2, '18:30', '21:30'), ('tutor28@gmail.com', 4, '18:30', '21:30'), ('tutor28@gmail.com', 7, '09:00', '12:00'),
        ('tutor29@gmail.com', 2, '13:30', '17:00'), ('tutor29@gmail.com', 3, '13:30', '17:00'), ('tutor29@gmail.com', 4, '13:30', '17:00'), ('tutor29@gmail.com', 5, '13:30', '17:00'), ('tutor29@gmail.com', 6, '13:30', '17:00'),
        ('tutor30@gmail.com', 3, '18:30', '21:30'), ('tutor30@gmail.com', 5, '18:30', '21:30'), ('tutor30@gmail.com', 8, '09:00', '11:30')
)
INSERT INTO tutor_availabilities (tutor_email, day_of_week, start_time, end_time, created_at, updated_at)
SELECT email, day_of_week, start_time, end_time, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM availability_seed;

SELECT setval('tutor_subject_registrations_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM tutor_subject_registrations), nextval('tutor_subject_registrations_id_seq')), TRUE);
SELECT setval('tutor_availabilities_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM tutor_availabilities), nextval('tutor_availabilities_id_seq')), TRUE);
