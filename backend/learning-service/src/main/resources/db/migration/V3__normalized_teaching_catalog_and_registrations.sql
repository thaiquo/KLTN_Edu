CREATE TABLE program_types (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE education_levels (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE catalog_categories (
    id BIGSERIAL PRIMARY KEY,
    program_type_id BIGINT NOT NULL REFERENCES program_types(id),
    education_level_id BIGINT REFERENCES education_levels(id),
    code VARCHAR(60) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_catalog_category_scope UNIQUE(program_type_id, education_level_id, code)
);

CREATE TABLE catalog_subjects (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES catalog_categories(id),
    code VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT uk_catalog_subject_category_code UNIQUE(category_id, code),
    CONSTRAINT uk_catalog_subject_category_name UNIQUE(category_id, name)
);

CREATE TABLE catalog_levels (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL REFERENCES catalog_subjects(id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    level_type VARCHAR(40) NOT NULL,
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    order_index INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_catalog_level_subject_code UNIQUE(subject_id, code),
    CONSTRAINT ck_catalog_level_type CHECK (level_type IN (
        'GRADE', 'EXAM_PREPARATION', 'UNIVERSITY_LEVEL',
        'CERTIFICATE_TARGET', 'SKILL_LEVEL', 'COACHING_LEVEL'
    ))
);

CREATE TABLE tutor_subject_registrations (
    id BIGSERIAL PRIMARY KEY,
    tutor_email VARCHAR(255) NOT NULL,
    tutor_profile_id BIGINT,
    program_type_id BIGINT NOT NULL REFERENCES program_types(id),
    education_level_id BIGINT REFERENCES education_levels(id),
    category_id BIGINT NOT NULL REFERENCES catalog_categories(id),
    subject_id BIGINT NOT NULL REFERENCES catalog_subjects(id),
    level_id BIGINT NOT NULL REFERENCES catalog_levels(id),
    experience_years INTEGER NOT NULL DEFAULT 0,
    tuition_min NUMERIC(12,2) NOT NULL,
    tuition_max NUMERIC(12,2) NOT NULL,
    description VARCHAR(1500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reject_reason VARCHAR(1000),
    review_note VARCHAR(1000),
    submitted_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP(6),
    reviewed_by_email VARCHAR(255),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_registration_status CHECK (status IN ('DRAFT','PENDING','APPROVED','REJECTED','SUSPENDED')),
    CONSTRAINT ck_registration_experience CHECK (experience_years BETWEEN 0 AND 60),
    CONSTRAINT ck_registration_tuition CHECK (tuition_min > 0 AND tuition_max >= tuition_min)
);

CREATE UNIQUE INDEX uk_active_tutor_subject_registration
    ON tutor_subject_registrations(lower(tutor_email), subject_id, level_id)
    WHERE status IN ('DRAFT','PENDING','APPROVED');

CREATE TABLE registration_evidence (
    id BIGSERIAL PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES tutor_subject_registrations(id) ON DELETE CASCADE,
    account_document_id BIGINT,
    evidence_type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    file_url VARCHAR(1000),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_registration_evidence_type CHECK (evidence_type IN (
        'DEGREE','CERTIFICATE','TRANSCRIPT','PORTFOLIO','VIDEO','GITHUB_PROJECT','WORK_EXPERIENCE','OTHER'
    )),
    CONSTRAINT ck_registration_evidence_source CHECK (account_document_id IS NOT NULL OR file_url IS NOT NULL)
);

CREATE TABLE catalog_import_jobs (
    id BIGSERIAL PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_rows INTEGER NOT NULL DEFAULT 0,
    success_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    error_report TEXT,
    created_by_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP(6),
    CONSTRAINT ck_catalog_import_status CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','PARTIAL'))
);

CREATE TABLE catalog_subject_suggestions (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES catalog_categories(id),
    suggested_subject_name VARCHAR(160) NOT NULL,
    suggested_level_name VARCHAR(160) NOT NULL,
    suggested_level_type VARCHAR(40) NOT NULL,
    note VARCHAR(1000),
    requested_by_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by_email VARCHAR(255),
    reviewed_at TIMESTAMP(6),
    reject_reason VARCHAR(1000),
    approved_subject_id BIGINT REFERENCES catalog_subjects(id),
    approved_level_id BIGINT REFERENCES catalog_levels(id),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_catalog_suggestion_status CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    CONSTRAINT ck_catalog_suggestion_level_type CHECK (suggested_level_type IN (
        'GRADE','EXAM_PREPARATION','UNIVERSITY_LEVEL','CERTIFICATE_TARGET','SKILL_LEVEL','COACHING_LEVEL'
    ))
);

CREATE INDEX idx_catalog_categories_scope ON catalog_categories(program_type_id, education_level_id, active, order_index);
CREATE INDEX idx_catalog_subjects_category ON catalog_subjects(category_id, active, order_index);
CREATE INDEX idx_catalog_levels_subject ON catalog_levels(subject_id, active, order_index);
CREATE INDEX idx_tutor_registrations_owner ON tutor_subject_registrations(lower(tutor_email), status, submitted_at);
CREATE INDEX idx_tutor_registrations_review ON tutor_subject_registrations(status, submitted_at);
CREATE INDEX idx_catalog_suggestions_review ON catalog_subject_suggestions(status, created_at);

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
