ALTER TABLE enrollment_requests
    ADD COLUMN student_date_of_birth DATE NULL,
    ADD COLUMN student_grade VARCHAR(50) NULL,
    ADD COLUMN student_address VARCHAR(500) NULL;
