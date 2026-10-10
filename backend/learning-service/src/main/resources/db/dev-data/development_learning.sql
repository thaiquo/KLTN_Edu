-- DEVELOPMENT-ONLY LEARNING SEEDS. Not loaded by Flyway db/migration.
-- Loaded by DevelopmentDataLoader only when the Spring "dev" profile is active.
-- Run account-service dev data first because this seed maps tutors by account users/tutors.

INSERT INTO tutor_authorization_states (user_id, status, tutor_profile_id, source_event_id, updated_at)
SELECT app_user.id, 'APPROVED', tutor_profile.id, 'dev-dataset-v1:' || LOWER(app_user.email), CURRENT_TIMESTAMP
FROM users app_user
JOIN tutor_profiles tutor_profile ON tutor_profile.user_id = app_user.id
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
        ('tutor1@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 5, 180000, 250000, 'Chuyên củng cố Toán lớp 12 phần hình học không gian, vector, khoảng cách và góc. Phù hợp học sinh cần dựng hình chậm, phân tích từng bước và luyện bài vận dụng.'),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 4, 160000, 220000, 'Kèm Toán THPT thiên về hàm số, khảo sát đồ thị, cực trị, mũ logarit và trình bày lời giải rõ ràng. Phù hợp học sinh muốn chắc đại số lớp 11-12.'),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 4, 180000, 220000, 'Vật lý THPT theo hiện tượng, công thức và dạng bài cơ bản.'),
        ('tutor3@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 7, 250000, 350000, 'Ôn thi THPT Quốc gia môn Toán theo lộ trình nâng cao, tập trung phân tích đề, chiến thuật thời gian và bài vận dụng có nhiều bước suy luận.'),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 3, 140000, 200000, 'Hỗ trợ học sinh mất gốc Toán lớp 10-11, ôn lại biến đổi đại số, phương trình cơ bản và bài tập trên lớp bằng nhịp học chậm, nhiều ví dụ nhỏ.'),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 3, 150000, 200000, 'Hóa học THPT, tập trung phương trình và bài tập tính toán.'),
        ('tutor5@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 6, 200000, 280000, 'Vật lý THPT theo sơ đồ công thức và bài mẫu.'),
        ('tutor6@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 5, 180000, 250000, 'Hóa học THPT theo chuyên đề phản ứng, cân bằng phương trình, mol và bài toán dung dịch. Mạnh về nhận diện lỗi sai và luyện bài tăng dần.'),
        ('tutor7@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 4, 180000, 260000, 'Ngữ pháp và giao tiếp tiếng Anh cho học sinh phổ thông.'),
        ('tutor8@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 5, 200000, 260000, 'Tiếng Anh ứng dụng kết hợp luyện nghe nói và từ vựng.'),
        ('tutor8@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 5, 240000, 300000, 'TOEIC Listening và Reading cho mục tiêu 500-750, chia kỹ năng theo dạng câu hỏi, từ vựng công sở và bộ đề ngắn để luyện đều mỗi tuần.'),
        ('tutor9@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 6, 250000, 350000, 'Luyện TOEIC 650-900 với chiến lược Part 5-7, đọc nhanh, bẫy ngữ pháp và quản lý thời gian trong đề thi đầy đủ.'),
        ('tutor10@gmail.com', 'LANGUAGE_CERT', 'IELTS', 7, 330000, 450000, 'IELTS Writing Task 1/2 và Speaking Part 2/3, sửa bài theo rubric, phát triển ý, coherence và từ vựng học thuật cho mục tiêu 6.5-8.0.'),
        ('tutor10@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 7, 300000, 380000, 'Academic English cho học sinh THPT và học vien cần nền tảng.'),
        ('tutor11@gmail.com', 'LANGUAGE_CERT', 'IELTS', 4, 280000, 380000, 'IELTS foundation đến band mục tiêu, có bài sửa hằng tuần.'),
        ('tutor12@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 3, 140000, 200000, 'Tiếng Anh cơ bản cho học sinh phổ thông cần tự tin hơn.'),
        ('tutor13@gmail.com', 'IT_TECH', 'JAVA', 5, 220000, 320000, 'Java Core cho OOP, class/object, collection, exception và clean code trong mini project. Có review code theo từng commit để sửa lỗi tư duy lập trình.'),
        ('tutor14@gmail.com', 'IT_TECH', 'JAVA', 4, 250000, 320000, 'Java backend nền tảng, tập trung đọc log, debug lỗi runtime, viết controller/service đơn giản và thực hành API theo từng bước.'),
        ('tutor14@gmail.com', 'IT_TECH', 'SPRING_BOOT', 4, 280000, 350000, 'Spring Boot REST API cho người mới: controller, validation, exception handler, JPA cơ bản và kết nối PostgreSQL bằng ví dụ CRUD rõ ràng.'),
        ('tutor15@gmail.com', 'IT_TECH', 'JAVA', 7, 300000, 380000, 'Java backend nâng cao cho sinh viên làm đồ án: transaction, design pattern đơn giản, unit test và review kiến trúc service trước khi triển khai.'),
        ('tutor15@gmail.com', 'IT_TECH', 'SPRING_BOOT', 7, 330000, 400000, 'Mentor Spring Boot project có đăng nhập, Spring Security, JWT, RBAC, phân quyền endpoint và cấu trúc service/repository cho sản phẩm thực tế.'),
        ('tutor15@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 7, 300000, 380000, 'Cơ sở dữ liệu cho backend Java: mô hình quan hệ, chuẩn hóa, transaction, thiết kế schema và mapping dữ liệu với service Spring Boot.'),
        ('tutor16@gmail.com', 'IT_TECH', 'PYTHON', 4, 200000, 280000, 'Python cơ bản đến xử lý dữ liệu nhỏ và automation đơn giản.'),
        ('tutor17@gmail.com', 'IT_TECH', 'PYTHON', 6, 250000, 330000, 'Python cho data exercise và bài tập thực hành.'),
        ('tutor17@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 6, 260000, 330000, 'SQL thực hành với join, aggregation, subquery và đọc kết quả trên bộ dữ liệu mẫu. Phù hợp sinh viên cần làm bài tập phân tích dữ liệu.'),
        ('tutor18@gmail.com', 'IT_TECH', 'REACTJS', 4, 220000, 300000, 'React cơ bản đến trung cấp qua component, props, hooks, routing và gọi REST API. Phù hợp học viên muốn dựng giao diện project rõ cấu trúc.'),
        ('tutor19@gmail.com', 'IT_TECH', 'REACTJS', 5, 250000, 350000, 'React nâng cao hơn về state management, tối ưu UX, tách logic khỏi component và refactor frontend đang có lỗi hoặc khó bảo trì.'),
        ('tutor20@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 8, 260000, 360000, 'Cơ sở dữ liệu nâng cao: thiết kế schema, index, execution plan, tối ưu truy vấn và phân tích trade-off cho ứng dụng nhiều bảng.'),
        ('tutor21@gmail.com', 'IT_TECH', 'JAVA', 2, 150000, 210000, 'Java nhập môn cho sinh viên năm đầu: cú pháp, vòng lặp, hàm, OOP cơ bản và bài tập trên lớp trước khi làm mini app.'),
        ('tutor21@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 2, 160000, 220000, 'SQL nền tảng cho bài tập trên lớp và mini app.'),
        ('tutor22@gmail.com', 'IT_TECH', 'PYTHON', 2, 140000, 200000, 'Python cho người mới bắt đầu, thực hành từng bước.'),
        ('tutor23@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 8, 160000, 230000, 'Toán phổ thông và ôn thi với phương pháp giải nhanh, nhận dạng dạng bài, mẹo kiểm tra đáp án và luyện đề vừa sức cho học sinh cần tăng tốc.'),
        ('tutor24@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 2, 130000, 190000, 'Hóa học nền tảng, bài tập vừa sức và ghi nhớ có logic.'),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 10, 320000, 420000, 'Vật lý nâng cao cho học sinh mục tiêu cao, tập trung cơ học, điện xoay chiều, phân tích hiện tượng và bài phân loại trong đề thi.'),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 10, 300000, 400000, 'Toán nâng cao cho học sinh khá giỏi, luyện bài phân loại, tư duy chứng minh, bất đẳng thức nhẹ và các câu vận dụng cao trong đề thi.'),
        ('tutor26@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 3, 190000, 250000, 'TOEIC theo lộ trình ngắn gọn, theo dõi tiến bộ từng tuần.'),
        ('tutor26@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 3, 180000, 230000, 'Tiếng Anh giao tiếp và ngữ pháp căn bản.'),
        ('tutor27@gmail.com', 'LANGUAGE_CERT', 'IELTS', 5, 280000, 380000, 'IELTS mục tiêu 6.5+ cho học viên cần cải thiện speaking fluency, phát âm, idea bank và bài tập cá nhân hóa theo điểm yếu từng kỹ năng.'),
        ('tutor27@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 5, 260000, 340000, 'TOEIC 650+ và 750+ theo chiến lược nghe đọc.'),
        ('tutor28@gmail.com', 'IT_TECH', 'SPRING_BOOT', 6, 300000, 380000, 'Mentor Spring Boot project theo sprint nhỏ: thiết kế REST API, service layer, integration test, checklist deploy và phối hợp database/API gateway.'),
        ('tutor28@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 6, 280000, 360000, 'SQL cho ứng dụng Java backend: tối ưu truy vấn, index thực tế, transaction và kiểm tra lỗi N+1 khi kết nối ORM với database.'),
        ('tutor29@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 2, 120000, 180000, 'Tiếng Anh nền tảng cho học sinh cần lấy lại gốc.'),
        ('tutor30@gmail.com', 'IT_TECH', 'JAVA', 3, 200000, 270000, 'Java cơ bản, OOP và bài tập thực hành.'),
        ('tutor30@gmail.com', 'IT_TECH', 'PYTHON', 3, 210000, 280000, 'Python cơ bản và bài tập thực hành theo buổi.')
),
resolved_registration AS (
    SELECT
        seed.*,
        app_user.id AS user_id,
        tutor_profile.id AS tutor_profile_id,
        subject.id AS subject_id,
        category.id AS category_id,
        category.program_type_id,
        category.education_level_id
    FROM registration_seed seed
    JOIN users app_user ON LOWER(app_user.email) = seed.email
    JOIN tutor_profiles tutor_profile ON tutor_profile.user_id = app_user.id
    JOIN catalog_categories category ON category.code = seed.category_code AND category.active = TRUE
    JOIN catalog_subjects subject ON subject.category_id = category.id AND subject.code = seed.subject_code AND subject.active = TRUE
),
updated_existing_registration AS (
    UPDATE tutor_subject_registrations existing
    SET
        description = seed.description,
        updated_at = CURRENT_TIMESTAMP
    FROM resolved_registration seed
    WHERE LOWER(existing.tutor_email) = seed.email
      AND existing.tutor_profile_id = seed.tutor_profile_id
      AND existing.subject_id = seed.subject_id
      AND existing.status <> 'SUSPENDED'
      AND existing.description IS DISTINCT FROM seed.description
    RETURNING existing.id
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

WITH historical_class_seed(email, category_code, subject_code, level_code, class_name, description, price_per_session, total_sessions, start_date, end_date) AS (
    VALUES
        ('tutor1@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_12', 'Lớp lịch sử Toán 12 - tutor1', 'Lớp lịch sử phục vụ dữ liệu đánh giá dev cho Toán THPT.', 200000, 12, DATE '2026-04-01', DATE '2026-05-15'),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_11', 'Lớp lịch sử Toán 11 - tutor2', 'Lớp lịch sử phục vụ dữ liệu đánh giá dev cho Toán THPT.', 180000, 10, DATE '2026-04-03', DATE '2026-05-10'),
        ('tutor3@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'NATIONAL_EXAM', 'Lớp lịch sử ôn thi Toán - tutor3', 'Lớp lịch sử ôn thi THPT phục vụ dữ liệu đánh giá dev.', 300000, 14, DATE '2026-03-25', DATE '2026-05-20'),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_10', 'Lớp lịch sử lấy gốc Toán - tutor4', 'Lớp lịch sử lấy lại nền tảng Toán phục vụ dữ liệu đánh giá dev.', 150000, 10, DATE '2026-04-05', DATE '2026-05-12'),
        ('tutor5@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 'GRADE_12', 'Lớp lịch sử Vật lý 12 - tutor5', 'Lớp lịch sử Vật lý THPT phục vụ dữ liệu đánh giá dev.', 230000, 12, DATE '2026-04-07', DATE '2026-05-19'),
        ('tutor6@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 'GRADE_11', 'Lớp lịch sử Hóa học 11 - tutor6', 'Lớp lịch sử Hóa học THPT phục vụ dữ liệu đánh giá dev.', 200000, 10, DATE '2026-04-08', DATE '2026-05-16'),
        ('tutor7@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 'GRADE_10', 'Lớp lịch sử Tiếng Anh phổ thông - tutor7', 'Lớp lịch sử Tiếng Anh phổ thông phục vụ dữ liệu đánh giá dev.', 200000, 10, DATE '2026-04-09', DATE '2026-05-17'),
        ('tutor8@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 'TOEIC_650', 'Lớp lịch sử TOEIC nền tảng - tutor8', 'Lớp lịch sử TOEIC phục vụ dữ liệu đánh giá dev.', 260000, 12, DATE '2026-04-10', DATE '2026-05-22'),
        ('tutor9@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 'TOEIC_750', 'Lớp lịch sử TOEIC tăng tốc - tutor9', 'Lớp lịch sử TOEIC phục vụ dữ liệu đánh giá dev.', 300000, 12, DATE '2026-04-11', DATE '2026-05-23'),
        ('tutor10@gmail.com', 'LANGUAGE_CERT', 'IELTS', 'IELTS_6_5', 'Lớp lịch sử IELTS Writing Speaking - tutor10', 'Lớp lịch sử IELTS phục vụ dữ liệu đánh giá dev.', 380000, 14, DATE '2026-03-28', DATE '2026-05-24'),
        ('tutor11@gmail.com', 'LANGUAGE_CERT', 'IELTS', 'IELTS_5_5', 'Lớp lịch sử IELTS foundation - tutor11', 'Lớp lịch sử IELTS nền tảng phục vụ dữ liệu đánh giá dev.', 320000, 10, DATE '2026-04-12', DATE '2026-05-18'),
        ('tutor12@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 'GRADE_10', 'Lớp lịch sử Tiếng Anh căn bản - tutor12', 'Lớp lịch sử Tiếng Anh căn bản phục vụ dữ liệu đánh giá dev.', 160000, 10, DATE '2026-04-13', DATE '2026-05-19'),
        ('tutor13@gmail.com', 'IT_TECH', 'JAVA', 'BEGINNER', 'Lớp lịch sử Java OOP - tutor13', 'Lớp lịch sử Java OOP phục vụ dữ liệu đánh giá dev.', 260000, 12, DATE '2026-04-14', DATE '2026-05-26'),
        ('tutor14@gmail.com', 'IT_TECH', 'SPRING_BOOT', 'BEGINNER', 'Lớp lịch sử Spring Boot API - tutor14', 'Lớp lịch sử Spring Boot phục vụ dữ liệu đánh giá dev.', 300000, 12, DATE '2026-04-15', DATE '2026-05-27'),
        ('tutor15@gmail.com', 'IT_TECH', 'JAVA', 'PROJECT_MENTORING', 'Lớp lịch sử Java backend project - tutor15', 'Lớp lịch sử Java backend phục vụ dữ liệu đánh giá dev.', 360000, 14, DATE '2026-03-30', DATE '2026-05-28'),
        ('tutor16@gmail.com', 'IT_TECH', 'PYTHON', 'BEGINNER', 'Lớp lịch sử Python cơ bản - tutor16', 'Lớp lịch sử Python phục vụ dữ liệu đánh giá dev.', 230000, 10, DATE '2026-04-16', DATE '2026-05-20'),
        ('tutor17@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 'YEAR_2', 'Lớp lịch sử SQL ứng dụng - tutor17', 'Lớp lịch sử SQL phục vụ dữ liệu đánh giá dev.', 290000, 12, DATE '2026-04-17', DATE '2026-05-29'),
        ('tutor18@gmail.com', 'IT_TECH', 'REACTJS', 'BEGINNER', 'Lớp lịch sử React component - tutor18', 'Lớp lịch sử React phục vụ dữ liệu đánh giá dev.', 260000, 10, DATE '2026-04-18', DATE '2026-05-22'),
        ('tutor19@gmail.com', 'IT_TECH', 'REACTJS', 'INTERMEDIATE', 'Lớp lịch sử React state management - tutor19', 'Lớp lịch sử React nâng cao phục vụ dữ liệu đánh giá dev.', 300000, 12, DATE '2026-04-19', DATE '2026-05-31'),
        ('tutor20@gmail.com', 'UNIVERSITY_IT', 'DATABASE_SYSTEMS', 'YEAR_3', 'Lớp lịch sử thiết kế Database - tutor20', 'Lớp lịch sử cơ sở dữ liệu phục vụ dữ liệu đánh giá dev.', 320000, 12, DATE '2026-04-20', DATE '2026-06-01'),
        ('tutor21@gmail.com', 'IT_TECH', 'JAVA', 'BEGINNER', 'Lớp lịch sử Java nhập môn - tutor21', 'Lớp lịch sử Java căn bản phục vụ dữ liệu đánh giá dev.', 180000, 8, DATE '2026-04-21', DATE '2026-05-21'),
        ('tutor22@gmail.com', 'IT_TECH', 'PYTHON', 'BEGINNER', 'Lớp lịch sử Python nhập môn - tutor22', 'Lớp lịch sử Python nhập môn phục vụ dữ liệu đánh giá dev.', 170000, 8, DATE '2026-04-22', DATE '2026-05-22'),
        ('tutor23@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_10', 'Lớp lịch sử Toán phổ thông - tutor23', 'Lớp lịch sử Toán phổ thông phục vụ dữ liệu đánh giá dev.', 190000, 10, DATE '2026-04-23', DATE '2026-05-30'),
        ('tutor24@gmail.com', 'HIGH_SCHOOL_NATURAL', 'CHEMISTRY', 'GRADE_10', 'Lớp lịch sử Hóa nền tảng - tutor24', 'Lớp lịch sử Hóa học nền tảng phục vụ dữ liệu đánh giá dev.', 150000, 8, DATE '2026-04-24', DATE '2026-05-24'),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 'NATIONAL_EXAM', 'Lớp lịch sử Vật lý nâng cao - tutor25', 'Lớp lịch sử Vật lý nâng cao phục vụ dữ liệu đánh giá dev.', 380000, 14, DATE '2026-03-31', DATE '2026-05-30'),
        ('tutor26@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 'TOEIC_650', 'Lớp lịch sử TOEIC theo lộ trình - tutor26', 'Lớp lịch sử TOEIC phục vụ dữ liệu đánh giá dev.', 220000, 10, DATE '2026-04-25', DATE '2026-05-31'),
        ('tutor27@gmail.com', 'LANGUAGE_CERT', 'IELTS', 'IELTS_6_5', 'Lớp lịch sử IELTS mục tiêu 6.5 - tutor27', 'Lớp lịch sử IELTS phục vụ dữ liệu đánh giá dev.', 330000, 12, DATE '2026-04-26', DATE '2026-06-02'),
        ('tutor28@gmail.com', 'IT_TECH', 'SPRING_BOOT', 'PROJECT_MENTORING', 'Lớp lịch sử Spring Boot project - tutor28', 'Lớp lịch sử Spring Boot project phục vụ dữ liệu đánh giá dev.', 340000, 14, DATE '2026-04-01', DATE '2026-06-03'),
        ('tutor29@gmail.com', 'HIGH_SCHOOL_LANGUAGE', 'ENGLISH', 'GRADE_10', 'Lớp lịch sử Tiếng Anh lấy gốc - tutor29', 'Lớp lịch sử Tiếng Anh lấy gốc phục vụ dữ liệu đánh giá dev.', 140000, 8, DATE '2026-04-27', DATE '2026-05-27'),
        ('tutor30@gmail.com', 'IT_TECH', 'JAVA', 'BEGINNER', 'Lớp lịch sử lập trình Java - tutor30', 'Lớp lịch sử lập trình Java phục vụ dữ liệu đánh giá dev.', 230000, 10, DATE '2026-04-28', DATE '2026-06-01')
),
resolved_historical_class AS (
    SELECT
        seed.*,
        app_user.full_name AS tutor_full_name,
        tutor_profile.id AS tutor_profile_id,
        registration.id AS registration_id,
        level.id AS level_id
    FROM historical_class_seed seed
    JOIN users app_user ON LOWER(app_user.email) = seed.email
    JOIN tutor_profiles tutor_profile ON tutor_profile.user_id = app_user.id
    JOIN catalog_categories category ON category.code = seed.category_code AND category.active = TRUE
    JOIN catalog_subjects subject ON subject.category_id = category.id AND subject.code = seed.subject_code AND subject.active = TRUE
    JOIN catalog_levels level ON level.subject_id = subject.id AND level.code = seed.level_code AND level.active = TRUE
    JOIN tutor_subject_registrations registration
      ON LOWER(registration.tutor_email) = seed.email
     AND registration.subject_id = subject.id
     AND registration.status = 'APPROVED'
)
INSERT INTO class_rooms (
    tutor_subject_registration_id, level_id, tutor_email, tutor_profile_id, tutor_full_name,
    name, description, learning_mode, meeting_link, address,
    max_students, max_pending_requests, price_per_session, total_price,
    sessions_per_week, duration_per_session_minutes, duration_value, duration_unit,
    start_date, end_date, total_sessions, syllabus_mode, syllabus_file_url,
    join_mode, join_key, status, reject_reason, reviewed_by_email, reviewed_at, created_at, updated_at,
    public_share_id
)
SELECT
    registration_id,
    level_id,
    email,
    tutor_profile_id,
    tutor_full_name,
    class_name,
    description,
    'ONLINE',
    'https://meet.google.com/dev-review-' || REPLACE(email, '@gmail.com', ''),
    NULL,
    12,
    18,
    price_per_session,
    price_per_session * total_sessions,
    2,
    90,
    6,
    'WEEK',
    start_date,
    end_date,
    total_sessions,
    'FORM',
    NULL,
    'OPEN_REQUEST',
    NULL,
    'CLOSED',
    NULL,
    'ngocquocthai.004@gmail.com',
    TIMESTAMP '2026-06-05 09:00:00',
    start_date::timestamp + TIME '08:00',
    TIMESTAMP '2026-06-05 09:00:00',
    gen_random_uuid()
FROM resolved_historical_class seed
WHERE NOT EXISTS (
    SELECT 1
    FROM class_rooms existing
    WHERE LOWER(existing.tutor_email) = seed.email
      AND existing.name = seed.class_name
);

WITH public_class_seed(email, category_code, subject_code, level_code, class_name, description, learning_mode, meeting_link, address, price_per_session, sessions_per_week, duration_minutes, duration_value, duration_unit, start_date, end_date, total_sessions, max_students, max_pending_requests) AS (
    VALUES
        ('tutor1@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_12',
         'Toán 12 Hình học không gian từng bước',
         'Lớp Toán 12 tập trung hình học không gian, vector, khoảng cách, góc giữa đường thẳng và mặt phẳng. Phù hợp học sinh hay mất phương hướng khi dựng hình, cần được tách bài thành các bước nhận diện giả thiết, chọn hệ trục, lập luận hình và luyện câu vận dụng có lời giải chậm rãi.',
         'ONLINE', 'https://meet.google.com/dev-math-geometry-t1', NULL, 220000, 2, 90, 12, 'WEEK', DATE '2026-10-19', DATE '2027-01-11', 24, 12, 18),
        ('tutor2@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_12',
         'Toán 12 Hàm số - mũ logarit - đồ thị',
         'Lớp Toán 12 thiên về đại số và giải tích: khảo sát hàm số, cực trị, tiệm cận, mũ logarit, đọc đồ thị và trình bày lời giải gọn. Lộ trình phù hợp học sinh làm được bài cơ bản nhưng thường sai bước biến đổi hoặc chưa biết chọn chiến thuật khi gặp câu tham số.',
         'ONLINE', 'https://meet.google.com/dev-math-functions-t2', NULL, 210000, 2, 90, 12, 'WEEK', DATE '2026-10-20', DATE '2027-01-12', 24, 12, 18),
        ('tutor3@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'NATIONAL_EXAM',
         'Ôn thi THPT Toán - chiến thuật 8+',
         'Lớp ôn thi THPT Quốc gia môn Toán dành cho học sinh mục tiêu 8 điểm trở lên. Mỗi tuần có bài bấm giờ, phân tích đề, gom lỗi sai theo chuyên đề và luyện câu vận dụng nhiều bước như hàm số, xác suất, số phức, hình học Oxyz và tối ưu thời gian trong phòng thi.',
         'ONLINE', 'https://meet.google.com/dev-math-exam-t3', NULL, 320000, 2, 90, 12, 'WEEK', DATE '2026-10-19', DATE '2027-01-11', 24, 10, 15),
        ('tutor4@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_10',
         'Toán 10 lấy lại gốc đại số và phương trình',
         'Lớp Toán 10 nhịp chậm cho học sinh mất gốc: tập hợp, biến đổi biểu thức, hàm bậc nhất/bậc hai, phương trình, bất phương trình và cách ghi lời giải trên lớp. Mục tiêu là làm chắc bài kiểm tra 15 phút, 1 tiết và bớt sợ khi gặp bài có chữ.',
         'OFFLINE', NULL, 'Quận 1, TP. Hồ Chí Minh - học nhóm nhỏ theo lịch cố định', 160000, 2, 90, 12, 'WEEK', DATE '2026-10-20', DATE '2027-01-12', 24, 8, 12),
        ('tutor23@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_11',
         'Toán 11 Lượng giác - dãy số - xác suất cơ bản',
         'Lớp Toán 11 củng cố lượng giác, phương trình lượng giác, dãy số, cấp số cộng - cấp số nhân và xác suất cơ bản. Cách học thiên về nhận dạng dạng bài, mẹo kiểm tra đáp án và luyện bài vừa sức để học sinh tăng tốc nhưng vẫn hiểu bản chất.',
         'ONLINE', 'https://meet.google.com/dev-math-grade11-t23', NULL, 190000, 2, 90, 12, 'WEEK', DATE '2026-10-19', DATE '2027-01-11', 24, 12, 18),
        ('tutor23@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_12',
         'Toán 12 tăng tốc nhận dạng dạng bài',
         'Lớp Toán 12 cho học sinh đã có nền tảng nhưng muốn tăng tốc trước kỳ kiểm tra và thi thử. Trọng tâm là nhận dạng nhanh dạng bài, chọn công cụ giải hợp lý, tránh bẫy đáp án, luyện đề ngắn theo thời gian và ghi lại sổ lỗi sai cá nhân sau mỗi buổi.',
         'OFFLINE', NULL, 'Quận Bình Thạnh, TP. Hồ Chí Minh - lớp nhóm tối đa 10 học viên', 220000, 2, 90, 12, 'WEEK', DATE '2026-10-20', DATE '2027-01-12', 24, 10, 15),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'MATHEMATICS', 'GRADE_12',
         'Toán 12 nâng cao vận dụng cao và tư duy chứng minh',
         'Lớp Toán 12 nâng cao cho học sinh khá giỏi, tập trung câu phân loại, bất đẳng thức nhẹ, cực trị có tham số, tư duy chứng minh và cách giải thích vì sao một hướng làm hiệu quả hơn hướng khác. Không nhồi mẹo, ưu tiên phân tích sâu và luyện bài khó có kiểm soát.',
         'ONLINE', 'https://meet.google.com/dev-math-advanced-t25', NULL, 360000, 2, 90, 12, 'WEEK', DATE '2026-10-24', DATE '2027-01-16', 24, 8, 12),
        ('tutor14@gmail.com', 'IT_TECH', 'SPRING_BOOT', 'PROJECT_MENTORING',
         'Spring Boot REST API thực chiến cho đồ án',
         'Lớp mentor Spring Boot theo project nhỏ: thiết kế REST API, validation, exception handler, JPA, PostgreSQL, phân tầng controller-service-repository và debug lỗi runtime. Phù hợp sinh viên cần biến ý tưởng đồ án thành backend chạy được, có checklist commit sau mỗi buổi.',
         'ONLINE', 'https://meet.google.com/dev-spring-project-t14', NULL, 320000, 2, 90, 12, 'WEEK', DATE '2026-10-20', DATE '2027-01-12', 24, 8, 12),
        ('tutor9@gmail.com', 'LANGUAGE_CERT', 'TOEIC', 'TOEIC_750',
         'TOEIC 750+ Reading speed và Part 5-7',
         'Lớp TOEIC mục tiêu 750+ tập trung đọc nhanh, bẫy ngữ pháp Part 5, nối ý Part 6, chiến thuật đọc Part 7 và quản lý thời gian khi làm full test. Mỗi tuần có mini test, bảng lỗi cá nhân và bài luyện từ vựng công sở theo ngữ cảnh.',
         'ONLINE', 'https://meet.google.com/dev-toeic-750-t9', NULL, 300000, 2, 90, 12, 'WEEK', DATE '2026-10-20', DATE '2027-01-12', 24, 10, 15),
        ('tutor25@gmail.com', 'HIGH_SCHOOL_NATURAL', 'PHYSICS', 'NATIONAL_EXAM',
         'Vật lý 12 ôn thi nâng cao cơ - điện',
         'Lớp Vật lý 12 cho học sinh mục tiêu điểm cao, tập trung cơ học, dao động, sóng, điện xoay chiều và bài phân loại trong đề thi. Mỗi chuyên đề bắt đầu từ hiện tượng, sau đó mới chốt công thức và luyện bài nhiều tầng để tránh học thuộc máy móc.',
         'OFFLINE', NULL, 'Quận Phú Nhuận, TP. Hồ Chí Minh - học cuối tuần nhóm nhỏ', 380000, 2, 90, 12, 'WEEK', DATE '2026-10-24', DATE '2027-01-16', 24, 8, 12)
),
resolved_public_class AS (
    SELECT
        seed.*,
        app_user.full_name AS tutor_full_name,
        tutor_profile.id AS tutor_profile_id,
        registration.id AS registration_id,
        level.id AS level_id
    FROM public_class_seed seed
    JOIN users app_user ON LOWER(app_user.email) = seed.email
    JOIN tutor_profiles tutor_profile ON tutor_profile.user_id = app_user.id
    JOIN catalog_categories category ON category.code = seed.category_code AND category.active = TRUE
    JOIN catalog_subjects subject ON subject.category_id = category.id AND subject.code = seed.subject_code AND subject.active = TRUE
    JOIN catalog_levels level ON level.subject_id = subject.id AND level.code = seed.level_code AND level.active = TRUE
    JOIN tutor_subject_registrations registration
      ON LOWER(registration.tutor_email) = seed.email
     AND registration.subject_id = subject.id
     AND registration.status = 'APPROVED'
    JOIN tutor_subject_registration_levels registration_level
      ON registration_level.registration_id = registration.id
     AND registration_level.level_id = level.id
),
updated_public_class AS (
    UPDATE class_rooms existing
    SET
        tutor_subject_registration_id = seed.registration_id,
        level_id = seed.level_id,
        tutor_profile_id = seed.tutor_profile_id,
        tutor_full_name = seed.tutor_full_name,
        description = seed.description,
        learning_mode = seed.learning_mode,
        meeting_link = seed.meeting_link,
        address = seed.address,
        max_students = seed.max_students,
        max_pending_requests = seed.max_pending_requests,
        price_per_session = seed.price_per_session,
        total_price = seed.price_per_session * seed.total_sessions,
        sessions_per_week = seed.sessions_per_week,
        duration_per_session_minutes = seed.duration_minutes,
        duration_value = seed.duration_value,
        duration_unit = seed.duration_unit,
        start_date = seed.start_date,
        end_date = seed.end_date,
        total_sessions = seed.total_sessions,
        syllabus_mode = 'FORM',
        syllabus_file_url = NULL,
        join_mode = 'OPEN_REQUEST',
        join_key = NULL,
        status = 'PUBLISHED',
        reject_reason = NULL,
        reviewed_by_email = 'ngocquocthai.004@gmail.com',
        reviewed_at = TIMESTAMP '2026-10-10 09:00:00',
        updated_at = CURRENT_TIMESTAMP
    FROM resolved_public_class seed
    WHERE LOWER(existing.tutor_email) = seed.email
      AND existing.name = seed.class_name
    RETURNING existing.id
)
INSERT INTO class_rooms (
    tutor_subject_registration_id, level_id, tutor_email, tutor_profile_id, tutor_full_name,
    name, description, learning_mode, meeting_link, address,
    max_students, max_pending_requests, price_per_session, total_price,
    sessions_per_week, duration_per_session_minutes, duration_value, duration_unit,
    start_date, end_date, total_sessions, syllabus_mode, syllabus_file_url,
    join_mode, join_key, status, reject_reason, reviewed_by_email, reviewed_at, created_at, updated_at,
    public_share_id
)
SELECT
    registration_id,
    level_id,
    email,
    tutor_profile_id,
    tutor_full_name,
    class_name,
    description,
    learning_mode,
    meeting_link,
    address,
    max_students,
    max_pending_requests,
    price_per_session,
    price_per_session * total_sessions,
    sessions_per_week,
    duration_minutes,
    duration_value,
    duration_unit,
    start_date,
    end_date,
    total_sessions,
    'FORM',
    NULL,
    'OPEN_REQUEST',
    NULL,
    'PUBLISHED',
    NULL,
    'ngocquocthai.004@gmail.com',
    TIMESTAMP '2026-10-10 09:00:00',
    TIMESTAMP '2026-10-10 09:00:00',
    CURRENT_TIMESTAMP,
    gen_random_uuid()
FROM resolved_public_class seed
WHERE NOT EXISTS (
    SELECT 1
    FROM class_rooms existing
    WHERE LOWER(existing.tutor_email) = seed.email
      AND existing.name = seed.class_name
);

WITH public_class_seed(email, class_name) AS (
    VALUES
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước'),
        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị'),
        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+'),
        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình'),
        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản'),
        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài'),
        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh'),
        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án'),
        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7'),
        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện')
)
DELETE FROM class_schedules
WHERE class_room_id IN (
    SELECT class_room.id
    FROM public_class_seed seed
    JOIN class_rooms class_room ON LOWER(class_room.tutor_email) = seed.email AND class_room.name = seed.class_name
);

WITH schedule_seed(email, class_name, day_of_week, start_time, end_time) AS (
    VALUES
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước', 2, '18:30', '20:00'),
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước', 4, '18:30', '20:00'),
        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị', 3, '18:00', '19:30'),
        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị', 5, '18:00', '19:30'),
        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+', 2, '20:00', '21:30'),
        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+', 4, '20:00', '21:30'),
        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình', 3, '13:30', '15:00'),
        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình', 5, '13:30', '15:00'),
        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản', 2, '18:00', '19:30'),
        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản', 4, '18:00', '19:30'),
        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài', 3, '19:30', '21:00'),
        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài', 5, '19:30', '21:00'),
        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh', 7, '08:30', '10:00'),
        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh', 8, '08:30', '10:00'),
        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án', 3, '20:00', '21:30'),
        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án', 5, '20:00', '21:30'),
        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7', 3, '18:30', '20:00'),
        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7', 5, '18:30', '20:00'),
        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện', 7, '10:15', '11:45'),
        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện', 8, '10:15', '11:45')
)
INSERT INTO class_schedules (class_room_id, day_of_week, start_time, end_time)
SELECT class_room.id, seed.day_of_week, seed.start_time, seed.end_time
FROM schedule_seed seed
JOIN class_rooms class_room ON LOWER(class_room.tutor_email) = seed.email AND class_room.name = seed.class_name;

WITH public_class_seed(email, class_name) AS (
    VALUES
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước'),
        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị'),
        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+'),
        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình'),
        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản'),
        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài'),
        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh'),
        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án'),
        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7'),
        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện')
)
DELETE FROM class_chapters
WHERE class_room_id IN (
    SELECT class_room.id
    FROM public_class_seed seed
    JOIN class_rooms class_room ON LOWER(class_room.tutor_email) = seed.email AND class_room.name = seed.class_name
);

WITH chapter_seed(email, class_name, title, description, expected_sessions, order_index) AS (
    VALUES
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước', 'Dựng hình, đọc giả thiết và vector nền tảng', 'Ôn quan hệ song song, vuông góc, vector trong không gian và cách chuyển hình vẽ thành dữ kiện tính toán.', 6, 1),
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước', 'Khoảng cách và góc trong không gian', 'Luyện khoảng cách điểm - đường - mặt, góc giữa đường thẳng và mặt phẳng bằng nhiều hướng giải.', 6, 2),
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước', 'Bài vận dụng hình học có phân tích từng bước', 'Rèn cách chọn hệ trục, chia bài khó thành bước nhỏ và kiểm tra điều kiện hình học.', 6, 3),
        ('tutor1@gmail.com', 'Toán 12 Hình học không gian từng bước', 'Tổng ôn đề kiểm tra và sửa lỗi sai cá nhân', 'Chữa đề theo lỗi dựng hình, lỗi công thức và lỗi trình bày để học sinh tự tin trước bài kiểm tra.', 6, 4),

        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị', 'Khảo sát hàm số và đọc đồ thị', 'Cực trị, đơn điệu, tiệm cận, bảng biến thiên và cách suy luận từ đồ thị.', 6, 1),
        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị', 'Mũ logarit và phương trình tham số', 'Củng cố biến đổi logarit, điều kiện xác định và cách tránh sai dấu khi giải nhanh.', 6, 2),
        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị', 'Câu vận dụng đại số - giải tích', 'Luyện bài nhiều bước, chọn phương pháp và trình bày lời giải gọn để không mất điểm.', 6, 3),
        ('tutor2@gmail.com', 'Toán 12 Hàm số - mũ logarit - đồ thị', 'Đề tổng hợp hàm số, đồ thị và logarit', 'Mini test có chữa lỗi cá nhân, phân biệt lỗi kiến thức và lỗi thao tác.', 6, 4),

        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+', 'Bản đồ đề thi và quản lý thời gian', 'Phân nhóm câu chắc điểm, câu cần chọn lọc và cách chia thời gian khi làm đề.', 6, 1),
        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+', 'Chuyên đề vận dụng hàm số - Oxyz - xác suất', 'Luyện câu vận dụng thường gặp và cách loại nhiễu trong đáp án trắc nghiệm.', 6, 2),
        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+', 'Bấm giờ đề ngắn và sửa lỗi sai', 'Mỗi buổi có bài thời gian giới hạn, ghi lại lỗi sai và chiến thuật cải thiện.', 6, 3),
        ('tutor3@gmail.com', 'Ôn thi THPT Toán - chiến thuật 8+', 'Mô phỏng đề thi và chiến thuật nước rút', 'Luyện đề tổng hợp, chọn thứ tự làm bài và ổn định tâm lý trước kỳ thi.', 6, 4),

        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình', 'Biến đổi biểu thức và kỹ năng ghi lời giải', 'Ôn phép biến đổi cơ bản, điều kiện xác định và trình bày bài rõ ràng.', 6, 1),
        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình', 'Hàm số bậc nhất, bậc hai và đồ thị', 'Đọc đồ thị, lập bảng giá trị, tìm đỉnh và ứng dụng vào bài kiểm tra.', 6, 2),
        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình', 'Phương trình, bất phương trình cơ bản', 'Luyện giải từng bước, tránh lỗi chuyển vế, chia hai vế và kiểm tra nghiệm.', 6, 3),
        ('tutor4@gmail.com', 'Toán 10 lấy lại gốc đại số và phương trình', 'Củng cố bài trên lớp và đề 1 tiết', 'Chữa bài tập trường, tổng hợp công thức và kiểm tra tiến bộ cuối khóa.', 6, 4),

        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản', 'Công thức lượng giác và phương trình lượng giác', 'Nhận dạng công thức, biến đổi chậm và luyện phương trình lượng giác cơ bản.', 6, 1),
        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản', 'Dãy số, cấp số cộng và cấp số nhân', 'Lập công thức số hạng, tổng và nhận diện dạng bài thường gặp.', 6, 2),
        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản', 'Xác suất cơ bản và tư duy đếm', 'Luyện quy tắc cộng, nhân, chỉnh hợp, tổ hợp và cách tránh đếm trùng.', 6, 3),
        ('tutor23@gmail.com', 'Toán 11 Lượng giác - dãy số - xác suất cơ bản', 'Đề tổng hợp tăng tốc', 'Mini test theo thời gian, mẹo kiểm tra đáp án và sửa lỗi sai cá nhân.', 6, 4),

        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài', 'Nhận dạng nhanh dạng bài lớp 12', 'Tổng hợp dấu hiệu nhận dạng hàm số, mũ logarit, tích phân và hình học thường gặp.', 6, 1),
        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài', 'Chiến thuật loại đáp án và kiểm tra lỗi', 'Luyện cách dùng đáp án, thay số, kiểm tra điều kiện và giảm lỗi thao tác.', 6, 2),
        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài', 'Đề ngắn bấm giờ theo chuyên đề', 'Rèn phản xạ giải đề nhanh nhưng vẫn giữ lý do chọn phương pháp.', 6, 3),
        ('tutor23@gmail.com', 'Toán 12 tăng tốc nhận dạng dạng bài', 'Sổ lỗi sai và đề tổng hợp', 'Chốt lỗi sai lặp lại, xây thói quen tự kiểm tra trước khi nộp bài.', 6, 4),

        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh', 'Tư duy phân tích bài vận dụng cao', 'Tách bài khó thành điều kiện, mục tiêu và công cụ giải phù hợp.', 6, 1),
        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh', 'Cực trị, tham số và bất đẳng thức nhẹ', 'Luyện bài phân loại có nhiều hướng giải, so sánh ưu nhược điểm từng hướng.', 6, 2),
        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh', 'Hình học và đại số nâng cao trong đề thi', 'Kết hợp tư duy chứng minh với kỹ thuật tính toán để xử lý câu khó.', 6, 3),
        ('tutor25@gmail.com', 'Toán 12 nâng cao vận dụng cao và tư duy chứng minh', 'Đề phân loại và chữa sâu', 'Chữa kỹ từng lời giải, chỉ ra điểm nghẽn tư duy và cách cải thiện.', 6, 4),

        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án', 'Khởi tạo project và thiết kế REST endpoint', 'Thiết kế resource, request/response DTO, validation và cấu trúc package dễ bảo trì.', 6, 1),
        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án', 'JPA, PostgreSQL và transaction cơ bản', 'Mapping entity, repository, quan hệ bảng và xử lý lỗi dữ liệu thường gặp.', 6, 2),
        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án', 'Exception handler, debug log và kiểm thử API', 'Đọc log, chuẩn hóa lỗi trả về và viết test/API checklist cho từng endpoint.', 6, 3),
        ('tutor14@gmail.com', 'Spring Boot REST API thực chiến cho đồ án', 'Hoàn thiện mini project và review code', 'Refactor service, kiểm tra security cơ bản và chuẩn bị demo đồ án.', 6, 4),

        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7', 'Part 5 grammar traps và từ vựng công sở', 'Ôn bẫy ngữ pháp, collocation và cách chọn nhanh trong câu ngắn.', 6, 1),
        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7', 'Part 6 nối ý và kiểm soát thời gian', 'Luyện đọc đoạn văn, chọn câu phù hợp mạch ý và tránh sa vào dịch từng từ.', 6, 2),
        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7', 'Part 7 đọc nhanh và câu hỏi nhiều đoạn', 'Chiến thuật scan, tìm keyword, xử lý double passage và triple passage.', 6, 3),
        ('tutor9@gmail.com', 'TOEIC 750+ Reading speed và Part 5-7', 'Full mini test và bảng lỗi cá nhân', 'Làm đề rút gọn, phân tích lỗi và đặt kế hoạch tăng điểm từng tuần.', 6, 4),

        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện', 'Cơ học và dao động từ hiện tượng đến công thức', 'Hiểu bản chất chuyển động, dao động và cách chọn công thức theo dữ kiện.', 6, 1),
        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện', 'Sóng và điện xoay chiều nâng cao', 'Phân tích hiện tượng, giản đồ và bài nhiều bước trong đề thi.', 6, 2),
        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện', 'Bài phân loại và lỗi suy luận thường gặp', 'Luyện câu khó, tách đại lượng và kiểm tra đơn vị để tránh lỗi máy móc.', 6, 3),
        ('tutor25@gmail.com', 'Vật lý 12 ôn thi nâng cao cơ - điện', 'Đề tổng hợp cơ - điện và chiến thuật thi', 'Bấm giờ đề, chữa sâu và tổng kết công thức theo bối cảnh sử dụng.', 6, 4)
)
INSERT INTO class_chapters (class_room_id, title, description, expected_sessions, order_index)
SELECT class_room.id, seed.title, seed.description, seed.expected_sessions, seed.order_index
FROM chapter_seed seed
JOIN class_rooms class_room ON LOWER(class_room.tutor_email) = seed.email AND class_room.name = seed.class_name;

WITH review_seed(tutor_email, class_name, student_email, rating, comment, created_at, updated_at) AS (
    VALUES
        ('tutor1@gmail.com', 'Lớp lịch sử Toán 12 - tutor1', 'student1@gmail.com', 5, 'Thầy cô hệ thống phần hàm số rất dễ hiểu, mỗi dạng bài đều có ví dụ và cách kiểm tra lỗi sai rõ ràng.', TIMESTAMP '2026-06-06 09:15:00', TIMESTAMP '2026-06-06 09:15:00'),
        ('tutor1@gmail.com', 'Lớp lịch sử Toán 12 - tutor1', 'student3@gmail.com', 5, 'Em thích cách giải từng bước khi ôn Toán 12, đặc biệt phần khảo sát đồ thị và bài vận dụng.', TIMESTAMP '2026-06-07 10:20:00', TIMESTAMP '2026-06-07 10:20:00'),
        ('tutor1@gmail.com', 'Lớp lịch sử Toán 12 - tutor1', 'student5@gmail.com', 4, 'Bài tập Toán được chia theo mức độ nên em theo kịp hơn, chỉ có vài buổi phần bài nâng cao hơi nhanh.', TIMESTAMP '2026-06-08 19:00:00', TIMESTAMP '2026-06-09 08:30:00'),
        ('tutor1@gmail.com', 'Lớp lịch sử Toán 12 - tutor1', 'student14@gmail.com', 5, 'Gia sư kiên nhẫn và nhắc lại công thức nhiều lần, giúp em tự tin hơn khi làm bài kiểm tra.', TIMESTAMP '2026-06-09 20:10:00', TIMESTAMP '2026-06-09 20:10:00'),
        ('tutor2@gmail.com', 'Lớp lịch sử Toán 11 - tutor2', 'student2@gmail.com', 5, 'Cách trình bày lời giải Toán rất gọn, em hiểu rõ hơn vì sao phải chọn phương pháp đó.', TIMESTAMP '2026-06-07 09:00:00', TIMESTAMP '2026-06-07 09:00:00'),
        ('tutor2@gmail.com', 'Lớp lịch sử Toán 11 - tutor2', 'student4@gmail.com', 4, 'Thầy giảng chắc và có nhiều bài luyện ngắn. Nếu phần tổng kết cuối buổi dài hơn một chút thì tốt hơn.', TIMESTAMP '2026-06-08 18:40:00', TIMESTAMP '2026-06-08 18:40:00'),
        ('tutor2@gmail.com', 'Lớp lịch sử Toán 11 - tutor2', 'student6@gmail.com', 4, 'Em thích cách thầy liên hệ Toán với Vật lý, nhờ vậy phần biến đổi công thức dễ nhớ hơn.', TIMESTAMP '2026-06-10 19:25:00', TIMESTAMP '2026-06-10 19:25:00'),
        ('tutor3@gmail.com', 'Lớp lịch sử ôn thi Toán - tutor3', 'student1@gmail.com', 5, 'Lộ trình ôn thi Toán rất rõ, bài tập phân tầng giúp em biết mình đang yếu phần nào.', TIMESTAMP '2026-06-06 11:00:00', TIMESTAMP '2026-06-06 11:00:00'),
        ('tutor3@gmail.com', 'Lớp lịch sử ôn thi Toán - tutor3', 'student3@gmail.com', 5, 'Thầy chữa đề kỹ và chỉ ra mẹo tránh mất điểm ở câu vận dụng, em thấy tiến bộ sau từng tuần.', TIMESTAMP '2026-06-07 20:30:00', TIMESTAMP '2026-06-08 07:45:00'),
        ('tutor3@gmail.com', 'Lớp lịch sử ôn thi Toán - tutor3', 'student11@gmail.com', 5, 'Các buổi luyện đề có thời gian bấm giờ nên em quen áp lực thi thật hơn.', TIMESTAMP '2026-06-09 18:00:00', TIMESTAMP '2026-06-09 18:00:00'),
        ('tutor3@gmail.com', 'Lớp lịch sử ôn thi Toán - tutor3', 'student15@gmail.com', 4, 'Nội dung ôn thi rất chất lượng, một số phần nâng cao cần chuẩn bị trước thì sẽ theo kịp hơn.', TIMESTAMP '2026-06-10 21:10:00', TIMESTAMP '2026-06-10 21:10:00'),
        ('tutor4@gmail.com', 'Lớp lịch sử lấy gốc Toán - tutor4', 'student2@gmail.com', 4, 'Cô giải thích chậm và dễ nghe, phù hợp với học sinh cần lấy lại nền tảng Toán.', TIMESTAMP '2026-06-09 09:35:00', TIMESTAMP '2026-06-09 09:35:00'),
        ('tutor4@gmail.com', 'Lớp lịch sử lấy gốc Toán - tutor4', 'student14@gmail.com', 3, 'Cô hỗ trợ nhiệt tình nhưng tốc độ đôi lúc vẫn hơi nhanh với em, cần thêm bài luyện cơ bản.', TIMESTAMP '2026-06-10 19:45:00', TIMESTAMP '2026-06-10 19:45:00'),
        ('tutor5@gmail.com', 'Lớp lịch sử Vật lý 12 - tutor5', 'student5@gmail.com', 5, 'Thầy giải thích Vật lý bằng sơ đồ hiện tượng nên phần công thức dễ hiểu hơn rất nhiều.', TIMESTAMP '2026-06-07 08:50:00', TIMESTAMP '2026-06-07 08:50:00'),
        ('tutor5@gmail.com', 'Lớp lịch sử Vật lý 12 - tutor5', 'student1@gmail.com', 4, 'Bài tập Vật lý được chọn sát chương trình, một vài bài khó cần thêm thời gian chữa kỹ hơn.', TIMESTAMP '2026-06-08 20:00:00', TIMESTAMP '2026-06-08 20:00:00'),
        ('tutor5@gmail.com', 'Lớp lịch sử Vật lý 12 - tutor5', 'student3@gmail.com', 5, 'Em thích cách thầy chỉ ra bản chất từng đại lượng trước khi thay số vào công thức.', TIMESTAMP '2026-06-10 18:10:00', TIMESTAMP '2026-06-11 08:00:00'),
        ('tutor6@gmail.com', 'Lớp lịch sử Hóa học 11 - tutor6', 'student2@gmail.com', 4, 'Cô giảng Hóa theo chuyên đề khá dễ nhớ, phần phương trình phản ứng được luyện đều.', TIMESTAMP '2026-06-08 09:20:00', TIMESTAMP '2026-06-08 09:20:00'),
        ('tutor6@gmail.com', 'Lớp lịch sử Hóa học 11 - tutor6', 'student4@gmail.com', 4, 'Cô chỉ lỗi sai khi cân bằng phương trình rất kỹ, bài tập về nhà vừa sức và có đáp án rõ.', TIMESTAMP '2026-06-09 19:15:00', TIMESTAMP '2026-06-09 19:15:00'),
        ('tutor7@gmail.com', 'Lớp lịch sử Tiếng Anh phổ thông - tutor7', 'student6@gmail.com', 5, 'Cô sửa phát âm nhẹ nhàng và giải thích ngữ pháp bằng ví dụ gần gũi nên em bớt ngại nói.', TIMESTAMP '2026-06-07 10:05:00', TIMESTAMP '2026-06-07 10:05:00'),
        ('tutor7@gmail.com', 'Lớp lịch sử Tiếng Anh phổ thông - tutor7', 'student12@gmail.com', 4, 'Bài học Tiếng Anh có nhiều tình huống giao tiếp thực tế, phần từ vựng nên có thêm quiz ngắn.', TIMESTAMP '2026-06-08 18:25:00', TIMESTAMP '2026-06-08 18:25:00'),
        ('tutor7@gmail.com', 'Lớp lịch sử Tiếng Anh phổ thông - tutor7', 'student4@gmail.com', 5, 'Em được sửa lỗi từng câu nên tự tin hơn khi nói, cô cũng gửi tài liệu ôn lại sau buổi học.', TIMESTAMP '2026-06-11 20:40:00', TIMESTAMP '2026-06-11 20:40:00'),
        ('tutor8@gmail.com', 'Lớp lịch sử TOEIC nền tảng - tutor8', 'student11@gmail.com', 5, 'Cô chia bài TOEIC theo từng dạng nghe đọc nên em luyện tập có mục tiêu rõ ràng.', TIMESTAMP '2026-06-06 08:45:00', TIMESTAMP '2026-06-06 08:45:00'),
        ('tutor8@gmail.com', 'Lớp lịch sử TOEIC nền tảng - tutor8', 'student6@gmail.com', 5, 'Phần chữa lỗi nghe TOEIC rất chi tiết, cô chỉ cả cách ghi chú từ khóa khi làm bài.', TIMESTAMP '2026-06-07 19:10:00', TIMESTAMP '2026-06-07 19:10:00'),
        ('tutor8@gmail.com', 'Lớp lịch sử TOEIC nền tảng - tutor8', 'student12@gmail.com', 4, 'Tài liệu TOEIC hữu ích và dễ theo dõi, em muốn có thêm bài mô phỏng đề đầy đủ.', TIMESTAMP '2026-06-09 21:00:00', TIMESTAMP '2026-06-09 21:00:00'),
        ('tutor8@gmail.com', 'Lớp lịch sử TOEIC nền tảng - tutor8', 'student15@gmail.com', 4, 'Cô phản hồi bài làm nhanh, phần chiến lược đọc hiểu giúp em tiết kiệm thời gian hơn.', TIMESTAMP '2026-06-10 20:30:00', TIMESTAMP '2026-06-10 20:30:00'),
        ('tutor9@gmail.com', 'Lớp lịch sử TOEIC tăng tốc - tutor9', 'student11@gmail.com', 5, 'Thầy hướng dẫn canh thời gian TOEIC rất thực tế, em biết cách bỏ qua câu khó hợp lý.', TIMESTAMP '2026-06-08 08:30:00', TIMESTAMP '2026-06-08 08:30:00'),
        ('tutor9@gmail.com', 'Lớp lịch sử TOEIC tăng tốc - tutor9', 'student12@gmail.com', 4, 'Bài luyện nghe đọc được giao đều, phần chữa bài nhanh nhưng vẫn đủ ý chính.', TIMESTAMP '2026-06-09 18:50:00', TIMESTAMP '2026-06-09 18:50:00'),
        ('tutor9@gmail.com', 'Lớp lịch sử TOEIC tăng tốc - tutor9', 'student6@gmail.com', 3, 'Thầy nắm đề tốt nhưng nhịp học hơi gấp, em cần thêm thời gian tự luyện giữa các buổi.', TIMESTAMP '2026-06-12 19:20:00', TIMESTAMP '2026-06-12 19:20:00'),
        ('tutor10@gmail.com', 'Lớp lịch sử IELTS Writing Speaking - tutor10', 'student12@gmail.com', 5, 'Cô sửa IELTS Writing theo rubric rất rõ, em hiểu vì sao bài chưa đạt tiêu chí task response.', TIMESTAMP '2026-06-06 09:40:00', TIMESTAMP '2026-06-06 09:40:00'),
        ('tutor10@gmail.com', 'Lớp lịch sử IELTS Writing Speaking - tutor10', 'student11@gmail.com', 5, 'Phần Speaking có feedback chi tiết về phát âm và cách mở rộng ý, rất hữu ích cho em.', TIMESTAMP '2026-06-07 20:15:00', TIMESTAMP '2026-06-08 09:05:00'),
        ('tutor10@gmail.com', 'Lớp lịch sử IELTS Writing Speaking - tutor10', 'student6@gmail.com', 5, 'Cô đưa ví dụ học thuật dễ áp dụng, bài sửa chi tiết nhưng không làm em bị quá tải.', TIMESTAMP '2026-06-10 19:30:00', TIMESTAMP '2026-06-10 19:30:00'),
        ('tutor10@gmail.com', 'Lớp lịch sử IELTS Writing Speaking - tutor10', 'student15@gmail.com', 4, 'Lộ trình IELTS rõ ràng, em mong có thêm một buổi riêng cho cách tự kiểm tra bài viết.', TIMESTAMP '2026-06-12 21:05:00', TIMESTAMP '2026-06-12 21:05:00'),
        ('tutor11@gmail.com', 'Lớp lịch sử IELTS foundation - tutor11', 'student12@gmail.com', 4, 'Thầy xây nền IELTS khá chắc, bài tập writing được sửa đều và có nhận xét cụ thể.', TIMESTAMP '2026-06-09 09:10:00', TIMESTAMP '2026-06-09 09:10:00'),
        ('tutor11@gmail.com', 'Lớp lịch sử IELTS foundation - tutor11', 'student6@gmail.com', 3, 'Thầy hỗ trợ khi em hỏi nhưng một số phần lý thuyết còn hơi dài, cần thêm hoạt động thực hành.', TIMESTAMP '2026-06-11 18:35:00', TIMESTAMP '2026-06-11 18:35:00'),
        ('tutor12@gmail.com', 'Lớp lịch sử Tiếng Anh căn bản - tutor12', 'student4@gmail.com', 4, 'Cô rất kiên nhẫn với phần ngữ pháp căn bản, bài luyện ngắn nên em không bị nản.', TIMESTAMP '2026-06-08 10:00:00', TIMESTAMP '2026-06-08 10:00:00'),
        ('tutor12@gmail.com', 'Lớp lịch sử Tiếng Anh căn bản - tutor12', 'student6@gmail.com', 3, 'Cô giảng dễ nghe nhưng nội dung đôi lúc còn đơn giản, em muốn có thêm bài nghe ở mức cao hơn.', TIMESTAMP '2026-06-10 20:10:00', TIMESTAMP '2026-06-10 20:10:00'),
        ('tutor13@gmail.com', 'Lớp lịch sử Java OOP - tutor13', 'student7@gmail.com', 5, 'Anh hướng dẫn Java OOP từ ví dụ nhỏ đến bài tập project nên em hiểu class và object rõ hơn.', TIMESTAMP '2026-06-06 08:20:00', TIMESTAMP '2026-06-06 08:20:00'),
        ('tutor13@gmail.com', 'Lớp lịch sử Java OOP - tutor13', 'student8@gmail.com', 5, 'Phần review code Java rất hữu ích, anh chỉ ra lỗi đặt tên và cách tách lớp dễ hiểu.', TIMESTAMP '2026-06-07 19:45:00', TIMESTAMP '2026-06-07 19:45:00'),
        ('tutor13@gmail.com', 'Lớp lịch sử Java OOP - tutor13', 'student15@gmail.com', 4, 'Bài OOP có ví dụ thực hành tốt, em muốn có thêm bài về exception và collection.', TIMESTAMP '2026-06-09 20:20:00', TIMESTAMP '2026-06-09 20:20:00'),
        ('tutor13@gmail.com', 'Lớp lịch sử Java OOP - tutor13', 'student13@gmail.com', 5, 'Anh giải thích tư duy lập trình rất rõ, bài tập sau buổi học giúp em nhớ lâu hơn.', TIMESTAMP '2026-06-11 21:00:00', TIMESTAMP '2026-06-12 08:10:00'),
        ('tutor14@gmail.com', 'Lớp lịch sử Spring Boot API - tutor14', 'student8@gmail.com', 5, 'Anh hướng dẫn Spring Boot qua API thực hành, phần validation và debug rất sát project.', TIMESTAMP '2026-06-07 09:30:00', TIMESTAMP '2026-06-07 09:30:00'),
        ('tutor14@gmail.com', 'Lớp lịch sử Spring Boot API - tutor14', 'student15@gmail.com', 4, 'Bài học backend có cấu trúc tốt, nếu có thêm sơ đồ luồng request thì sẽ dễ hình dung hơn.', TIMESTAMP '2026-06-09 18:05:00', TIMESTAMP '2026-06-09 18:05:00'),
        ('tutor14@gmail.com', 'Lớp lịch sử Spring Boot API - tutor14', 'student7@gmail.com', 4, 'Anh debug từng lỗi compile và lỗi API rất kiên nhẫn, em học được cách đọc log tốt hơn.', TIMESTAMP '2026-06-10 20:25:00', TIMESTAMP '2026-06-10 20:25:00'),
        ('tutor15@gmail.com', 'Lớp lịch sử Java backend project - tutor15', 'student8@gmail.com', 5, 'Mentor backend rất chắc, anh hướng dẫn từ kiến trúc service đến cách thiết kế database.', TIMESTAMP '2026-06-06 10:50:00', TIMESTAMP '2026-06-06 10:50:00'),
        ('tutor15@gmail.com', 'Lớp lịch sử Java backend project - tutor15', 'student15@gmail.com', 5, 'Em được review project Java khá kỹ, phần góp ý về API và transaction rất thực tế.', TIMESTAMP '2026-06-08 19:35:00', TIMESTAMP '2026-06-09 07:50:00'),
        ('tutor15@gmail.com', 'Lớp lịch sử Java backend project - tutor15', 'student7@gmail.com', 5, 'Anh đưa lộ trình backend rõ ràng, mỗi buổi đều có mục tiêu và bài thực hành cụ thể.', TIMESTAMP '2026-06-10 18:15:00', TIMESTAMP '2026-06-10 18:15:00'),
        ('tutor15@gmail.com', 'Lớp lịch sử Java backend project - tutor15', 'student9@gmail.com', 5, 'Phần kết nối SQL với Spring Boot rất dễ theo, em áp dụng được ngay vào bài tập nhóm.', TIMESTAMP '2026-06-12 21:20:00', TIMESTAMP '2026-06-12 21:20:00'),
        ('tutor16@gmail.com', 'Lớp lịch sử Python cơ bản - tutor16', 'student9@gmail.com', 4, 'Anh giải thích Python dễ hiểu, bài tập xử lý dữ liệu nhỏ phù hợp với người mới học.', TIMESTAMP '2026-06-09 08:40:00', TIMESTAMP '2026-06-09 08:40:00'),
        ('tutor16@gmail.com', 'Lớp lịch sử Python cơ bản - tutor16', 'student13@gmail.com', 3, 'Nội dung Python ổn nhưng phần bài tập đôi lúc hơi ít thử thách, em muốn luyện thêm case thực tế.', TIMESTAMP '2026-06-11 19:50:00', TIMESTAMP '2026-06-11 19:50:00'),
        ('tutor17@gmail.com', 'Lớp lịch sử SQL ứng dụng - tutor17', 'student9@gmail.com', 5, 'Thầy kết hợp Python và SQL khá mạch lạc, phần join và aggregation được giải thích bằng dữ liệu mẫu.', TIMESTAMP '2026-06-07 09:05:00', TIMESTAMP '2026-06-07 09:05:00'),
        ('tutor17@gmail.com', 'Lớp lịch sử SQL ứng dụng - tutor17', 'student15@gmail.com', 4, 'Bài tập SQL có độ khó tăng dần, em hiểu hơn cách đọc kết quả truy vấn.', TIMESTAMP '2026-06-09 20:45:00', TIMESTAMP '2026-06-09 20:45:00'),
        ('tutor17@gmail.com', 'Lớp lịch sử SQL ứng dụng - tutor17', 'student8@gmail.com', 4, 'Thầy chữa câu lệnh rõ và chỉ ra lỗi logic, phần tối ưu truy vấn có thể mở rộng thêm.', TIMESTAMP '2026-06-12 18:20:00', TIMESTAMP '2026-06-12 18:20:00'),
        ('tutor18@gmail.com', 'Lớp lịch sử React component - tutor18', 'student10@gmail.com', 4, 'Chị hướng dẫn React component và hooks khá dễ hiểu, ví dụ chia component sát với project của em.', TIMESTAMP '2026-06-08 09:25:00', TIMESTAMP '2026-06-08 09:25:00'),
        ('tutor18@gmail.com', 'Lớp lịch sử React component - tutor18', 'student8@gmail.com', 3, 'Chị hỗ trợ tốt nhưng phần state management hơi nhanh, em cần thêm bài luyện sau buổi học.', TIMESTAMP '2026-06-10 21:15:00', TIMESTAMP '2026-06-10 21:15:00'),
        ('tutor19@gmail.com', 'Lớp lịch sử React state management - tutor19', 'student10@gmail.com', 5, 'Anh hướng dẫn React state management rất thực tế, em biết cách tách logic khỏi component.', TIMESTAMP '2026-06-06 09:55:00', TIMESTAMP '2026-06-06 09:55:00'),
        ('tutor19@gmail.com', 'Lớp lịch sử React state management - tutor19', 'student13@gmail.com', 5, 'Phần refactor giao diện và xử lý API giúp project frontend của em gọn hơn nhiều.', TIMESTAMP '2026-06-08 19:05:00', TIMESTAMP '2026-06-08 19:05:00'),
        ('tutor19@gmail.com', 'Lớp lịch sử React state management - tutor19', 'student8@gmail.com', 4, 'Anh góp ý UX rõ ràng, đôi lúc tốc độ code mẫu hơi nhanh nhưng tài liệu gửi lại rất đầy đủ.', TIMESTAMP '2026-06-11 20:55:00', TIMESTAMP '2026-06-12 07:30:00'),
        ('tutor20@gmail.com', 'Lớp lịch sử thiết kế Database - tutor20', 'student15@gmail.com', 5, 'Thầy dạy database rất chắc, phần index và thiết kế schema được giải thích bằng tình huống thật.', TIMESTAMP '2026-06-07 08:15:00', TIMESTAMP '2026-06-07 08:15:00'),
        ('tutor20@gmail.com', 'Lớp lịch sử thiết kế Database - tutor20', 'student8@gmail.com', 4, 'Bài SQL có ví dụ thực tế và được chữa kỹ, phần chuẩn hóa dữ liệu hơi nhiều khái niệm mới.', TIMESTAMP '2026-06-09 18:45:00', TIMESTAMP '2026-06-09 18:45:00'),
        ('tutor20@gmail.com', 'Lớp lịch sử thiết kế Database - tutor20', 'student9@gmail.com', 5, 'Em hiểu rõ hơn cách dùng index và đọc kế hoạch truy vấn sau các buổi học với thầy.', TIMESTAMP '2026-06-11 19:35:00', TIMESTAMP '2026-06-11 19:35:00'),
        ('tutor20@gmail.com', 'Lớp lịch sử thiết kế Database - tutor20', 'student13@gmail.com', 4, 'Thầy có kiến thức sâu về cơ sở dữ liệu, nếu có thêm bài tổng kết cuối khóa thì rất tốt.', TIMESTAMP '2026-06-13 20:05:00', TIMESTAMP '2026-06-13 20:05:00'),
        ('tutor21@gmail.com', 'Lớp lịch sử Java nhập môn - tutor21', 'student7@gmail.com', 4, 'Anh dạy Java nhập môn gần gũi, bài tập gắn với ví dụ trên lớp nên em dễ theo.', TIMESTAMP '2026-06-09 10:15:00', TIMESTAMP '2026-06-09 10:15:00'),
        ('tutor21@gmail.com', 'Lớp lịch sử Java nhập môn - tutor21', 'student15@gmail.com', 3, 'Anh nhiệt tình nhưng kinh nghiệm xử lý bài nâng cao chưa nhiều, phù hợp hơn với phần căn bản.', TIMESTAMP '2026-06-12 19:00:00', TIMESTAMP '2026-06-12 19:00:00'),
        ('tutor22@gmail.com', 'Lớp lịch sử Python nhập môn - tutor22', 'student13@gmail.com', 4, 'Chị rất kiên nhẫn khi dạy Python cho người mới, mỗi bài đều có ví dụ nhỏ để thực hành.', TIMESTAMP '2026-06-08 08:35:00', TIMESTAMP '2026-06-08 08:35:00'),
        ('tutor22@gmail.com', 'Lớp lịch sử Python nhập môn - tutor22', 'student9@gmail.com', 3, 'Cách giảng dễ nghe nhưng nội dung còn khá căn bản, em cần thêm bài về xử lý file và dữ liệu.', TIMESTAMP '2026-06-11 18:55:00', TIMESTAMP '2026-06-11 18:55:00'),
        ('tutor23@gmail.com', 'Lớp lịch sử Toán phổ thông - tutor23', 'student1@gmail.com', 5, 'Thầy có nhiều mẹo giải Toán phổ thông nhanh, phần luyện đề được sắp xếp hợp lý.', TIMESTAMP '2026-06-07 11:10:00', TIMESTAMP '2026-06-07 11:10:00'),
        ('tutor23@gmail.com', 'Lớp lịch sử Toán phổ thông - tutor23', 'student3@gmail.com', 4, 'Bài giảng Toán rõ và nhiều ví dụ, một số phần mẹo giải cần được giải thích chậm hơn.', TIMESTAMP '2026-06-09 20:35:00', TIMESTAMP '2026-06-09 20:35:00'),
        ('tutor23@gmail.com', 'Lớp lịch sử Toán phổ thông - tutor23', 'student14@gmail.com', 4, 'Thầy động viên học sinh tốt, bài tập vừa sức nên em không còn sợ môn Toán như trước.', TIMESTAMP '2026-06-12 18:30:00', TIMESTAMP '2026-06-12 18:30:00'),
        ('tutor24@gmail.com', 'Lớp lịch sử Hóa nền tảng - tutor24', 'student2@gmail.com', 4, 'Cô dạy Hóa nền tảng gần gũi, phần ghi nhớ phản ứng có mẹo khá dễ áp dụng.', TIMESTAMP '2026-06-10 09:45:00', TIMESTAMP '2026-06-10 09:45:00'),
        ('tutor24@gmail.com', 'Lớp lịch sử Hóa nền tảng - tutor24', 'student4@gmail.com', 3, 'Cô thân thiện nhưng phần chữa bài tính toán còn hơi ngắn, em cần thêm ví dụ từng bước.', TIMESTAMP '2026-06-13 19:40:00', TIMESTAMP '2026-06-13 19:40:00'),
        ('tutor25@gmail.com', 'Lớp lịch sử Vật lý nâng cao - tutor25', 'student5@gmail.com', 5, 'Thầy dạy Vật lý nâng cao rất chắc, phần phân tích hiện tượng giúp em hiểu sâu hơn công thức.', TIMESTAMP '2026-06-06 08:55:00', TIMESTAMP '2026-06-06 08:55:00'),
        ('tutor25@gmail.com', 'Lớp lịch sử Vật lý nâng cao - tutor25', 'student1@gmail.com', 5, 'Bài tập phân loại rõ ràng, thầy chữa kỹ các lỗi suy luận trong bài Vật lý khó.', TIMESTAMP '2026-06-08 18:20:00', TIMESTAMP '2026-06-08 18:20:00'),
        ('tutor25@gmail.com', 'Lớp lịch sử Vật lý nâng cao - tutor25', 'student3@gmail.com', 5, 'Em thích cách thầy liên hệ Toán và Vật lý trong các bài nâng cao, rất phù hợp ôn thi.', TIMESTAMP '2026-06-11 20:00:00', TIMESTAMP '2026-06-12 08:20:00'),
        ('tutor25@gmail.com', 'Lớp lịch sử Vật lý nâng cao - tutor25', 'student14@gmail.com', 4, 'Nội dung nâng cao chất lượng, có vài buổi hơi khó nhưng thầy luôn gửi lời giải bổ sung.', TIMESTAMP '2026-06-14 19:10:00', TIMESTAMP '2026-06-14 19:10:00'),
        ('tutor26@gmail.com', 'Lớp lịch sử TOEIC theo lộ trình - tutor26', 'student11@gmail.com', 5, 'Cô chia mục tiêu TOEIC theo từng tuần nên em dễ theo dõi tiến bộ của mình.', TIMESTAMP '2026-06-08 10:25:00', TIMESTAMP '2026-06-08 10:25:00'),
        ('tutor26@gmail.com', 'Lớp lịch sử TOEIC theo lộ trình - tutor26', 'student6@gmail.com', 4, 'Bài nghe đọc TOEIC vừa sức, cô phản hồi nhanh khi em gửi bài làm thêm.', TIMESTAMP '2026-06-10 18:15:00', TIMESTAMP '2026-06-10 18:15:00'),
        ('tutor26@gmail.com', 'Lớp lịch sử TOEIC theo lộ trình - tutor26', 'student12@gmail.com', 4, 'Lộ trình rõ và ít gây áp lực, em muốn có thêm đề tổng hợp vào cuối khóa.', TIMESTAMP '2026-06-12 20:50:00', TIMESTAMP '2026-06-12 20:50:00'),
        ('tutor27@gmail.com', 'Lớp lịch sử IELTS mục tiêu 6.5 - tutor27', 'student12@gmail.com', 5, 'Cô linh hoạt giữa IELTS và TOEIC, phần đặt mục tiêu đầu ra rất cụ thể cho từng học viên.', TIMESTAMP '2026-06-07 09:50:00', TIMESTAMP '2026-06-07 09:50:00'),
        ('tutor27@gmail.com', 'Lớp lịch sử IELTS mục tiêu 6.5 - tutor27', 'student11@gmail.com', 5, 'Feedback Speaking chi tiết và thân thiện, em biết cách sửa lỗi phát âm lặp lại.', TIMESTAMP '2026-06-09 19:55:00', TIMESTAMP '2026-06-09 19:55:00'),
        ('tutor27@gmail.com', 'Lớp lịch sử IELTS mục tiêu 6.5 - tutor27', 'student6@gmail.com', 4, 'Tài liệu IELTS phù hợp với mục tiêu 6.5, phần bài tập tự học hơi nhiều nhưng có ích.', TIMESTAMP '2026-06-13 18:25:00', TIMESTAMP '2026-06-13 18:25:00'),
        ('tutor28@gmail.com', 'Lớp lịch sử Spring Boot project - tutor28', 'student8@gmail.com', 5, 'Anh mentor Spring Boot theo sprint nhỏ nên project của em tiến bộ rõ sau từng buổi.', TIMESTAMP '2026-06-06 09:05:00', TIMESTAMP '2026-06-06 09:05:00'),
        ('tutor28@gmail.com', 'Lớp lịch sử Spring Boot project - tutor28', 'student15@gmail.com', 4, 'Phần thiết kế API và SQL rất thực tế, em muốn có thêm checklist deploy cuối khóa.', TIMESTAMP '2026-06-08 20:15:00', TIMESTAMP '2026-06-08 20:15:00'),
        ('tutor28@gmail.com', 'Lớp lịch sử Spring Boot project - tutor28', 'student7@gmail.com', 5, 'Anh giải thích cấu trúc service và repository rõ ràng, dễ áp dụng vào đồ án môn học.', TIMESTAMP '2026-06-11 19:05:00', TIMESTAMP '2026-06-12 08:05:00'),
        ('tutor28@gmail.com', 'Lớp lịch sử Spring Boot project - tutor28', 'student9@gmail.com', 4, 'Bài học backend có nhiều ví dụ thật, đôi lúc phần tối ưu truy vấn hơi nhanh với em.', TIMESTAMP '2026-06-14 21:15:00', TIMESTAMP '2026-06-14 21:15:00'),
        ('tutor29@gmail.com', 'Lớp lịch sử Tiếng Anh lấy gốc - tutor29', 'student4@gmail.com', 3, 'Cô thân thiện và phù hợp học sinh mới lấy lại gốc, nhưng bài luyện nghe còn hơi ít.', TIMESTAMP '2026-06-12 09:30:00', TIMESTAMP '2026-06-12 09:30:00'),
        ('tutor29@gmail.com', 'Lớp lịch sử Tiếng Anh lấy gốc - tutor29', 'student6@gmail.com', 2, 'Kiến thức của cô ổn nhưng cách trình bày chưa thật sự phù hợp với em và lịch học đôi lúc thay đổi.', TIMESTAMP '2026-06-15 18:40:00', TIMESTAMP '2026-06-15 18:40:00'),
        ('tutor30@gmail.com', 'Lớp lịch sử lập trình Java - tutor30', 'student7@gmail.com', 4, 'Anh hướng dẫn Java cơ bản và OOP khá rõ, bài tập thực hành giúp em nhớ cú pháp hơn.', TIMESTAMP '2026-06-10 08:25:00', TIMESTAMP '2026-06-10 08:25:00'),
        ('tutor30@gmail.com', 'Lớp lịch sử lập trình Java - tutor30', 'student13@gmail.com', 3, 'Anh nhiệt tình nhưng nội dung còn thiên về căn bản, em muốn có thêm bài project nhỏ cuối khóa.', TIMESTAMP '2026-06-13 20:20:00', TIMESTAMP '2026-06-13 20:20:00')
),
resolved_review AS (
    SELECT
        student_user.id AS student_id,
        tutor_user.id AS tutor_id,
        class_room.id AS classroom_id,
        seed.rating,
        seed.comment,
        seed.created_at,
        seed.updated_at
    FROM review_seed seed
    JOIN users student_user ON LOWER(student_user.email) = seed.student_email
    JOIN users tutor_user ON LOWER(tutor_user.email) = seed.tutor_email
    JOIN class_rooms class_room
      ON LOWER(class_room.tutor_email) = seed.tutor_email
     AND class_room.name = seed.class_name
)
INSERT INTO tutor_reviews (student_id, tutor_id, classroom_id, rating, comment, created_at, updated_at)
SELECT student_id, tutor_id, classroom_id, rating, comment, created_at, updated_at
FROM resolved_review
ON CONFLICT (student_id, classroom_id) DO NOTHING;

SELECT setval('tutor_subject_registrations_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM tutor_subject_registrations), nextval('tutor_subject_registrations_id_seq')), TRUE);
SELECT setval('tutor_availabilities_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM tutor_availabilities), nextval('tutor_availabilities_id_seq')), TRUE);
SELECT setval('class_rooms_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM class_rooms), nextval('class_rooms_id_seq')), TRUE);
SELECT setval('tutor_reviews_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM tutor_reviews), nextval('tutor_reviews_id_seq')), TRUE);
