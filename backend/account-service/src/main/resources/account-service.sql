-- =============================================
-- ACCOUNT SERVICE DEVELOPMENT SEED DATA
-- Password for all seeded users: 12345678
-- =============================================

INSERT INTO users (
    id,
    email,
    password,
    full_name,
    phone,
    date_of_birth,
    email_verified,
    account_status,
    created_at,
    updated_at
)
VALUES
    (1, 'student1@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Nguyen Van Student 1', '0900000001', '2004-01-12', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, 'student2@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Tran Thi Student 2', '0900000002', '2005-03-20', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (3, 'student3@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Le Van Student 3', '0900000003', '2003-07-05', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (4, 'student4@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Pham Thi Student 4', '0900000004', '2006-09-16', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (5, 'student5@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Do Van Student 5', '0900000005', '2004-11-28', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (6, 'tutor1@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Nguyen Minh Tutor', '0910000001', '1998-02-10', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (7, 'tutor2@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Tran Quoc Tutor', '0910000002', '1997-05-15', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (8, 'tutor3@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Le Hoang Tutor', '0910000003', '1996-10-08', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (9, 'staff1@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Staff Operator 1', '0920000001', '1995-04-18', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (10, 'staff2@test.com', '$2a$10$NwCLR.ehlrY/84eVJ/EE2.eMRTJ.QkVhrPm0RqbBU8qtuZwTaCOXu', 'Staff Operator 2', '0920000002', '1994-12-22', true, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO user_roles (id, user_id, role)
VALUES
    (1, 1, 'STUDENT'),
    (2, 2, 'STUDENT'),
    (3, 3, 'STUDENT'),
    (4, 4, 'STUDENT'),
    (5, 5, 'STUDENT'),
    (6, 6, 'TUTOR'),
    (7, 7, 'TUTOR'),
    (8, 8, 'TUTOR'),
    (9, 9, 'STAFF'),
    (10, 10, 'STAFF');

INSERT INTO subject_categories (id, name)
VALUES
    (1, 'Toan hoc'),
    (2, 'Cong nghe thong tin'),
    (3, 'Ngoai ngu'),
    (4, 'Khoa hoc tu nhien');

INSERT INTO subjects (id, name, category_id, active)
VALUES
    (1, 'Toan lop 12', 1, true),
    (2, 'Giai tich 1', 1, true),
    (3, 'Java', 2, true),
    (4, 'Spring Boot', 2, true),
    (5, 'Co so du lieu', 2, true),
    (6, 'Data Structures', 2, true),
    (7, 'Machine Learning', 2, true),
    (8, 'IELTS', 3, true),
    (9, 'Tieng Anh giao tiep', 3, true),
    (10, 'Vat ly', 4, true),
    (11, 'Hoa hoc', 4, true);

INSERT INTO tutors (
    id,
    user_id,
    bio,
    education,
    experience_years,
    verification_status,
    status,
    rejection_reason,
    created_at,
    updated_at
)
VALUES
    (
        1,
        6,
        'Co kinh nghiem giang day Java, Spring Boot va co so du lieu cho sinh vien.',
        'Dai hoc Cong nghiep TP.HCM',
        2,
        'PENDING',
        'PENDING',
        NULL,
        CURRENT_TIMESTAMP - INTERVAL '31 hours',
        CURRENT_TIMESTAMP - INTERVAL '31 hours'
    ),
    (
        2,
        7,
        'Huong dan IELTS va tieng Anh giao tiep theo lo trinh ca nhan hoa.',
        'Dai hoc Ngoai thuong',
        3,
        'APPROVED',
        'APPROVED',
        NULL,
        CURRENT_TIMESTAMP - INTERVAL '2 days',
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    ),
    (
        3,
        8,
        'On thi Toan lop 12 va Giai tich 1 cho hoc vien mat goc.',
        'Dai hoc Su pham TP.HCM',
        4,
        'REJECTED',
        'REJECTED',
        'Thong tin hoc van chua day du',
        CURRENT_TIMESTAMP - INTERVAL '3 days',
        CURRENT_TIMESTAMP - INTERVAL '12 hours'
    );

INSERT INTO tutor_subjects (tutor_id, subject_id)
VALUES
    (1, 3),
    (1, 4),
    (1, 5),
    (1, 6),
    (2, 8),
    (2, 9),
    (3, 1),
    (3, 2);

SELECT setval(pg_get_serial_sequence('users', 'id'), 10, true);
SELECT setval(pg_get_serial_sequence('user_roles', 'id'), 10, true);
SELECT setval(pg_get_serial_sequence('subject_categories', 'id'), 4, true);
SELECT setval(pg_get_serial_sequence('subjects', 'id'), 11, true);
SELECT setval(pg_get_serial_sequence('tutors', 'id'), 3, true);
