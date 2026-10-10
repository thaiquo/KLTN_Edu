-- V9__create_tutor_follows_table.sql
-- Migration for 1-way Student-to-Tutor Follow relationship in EduConnect Community

CREATE TABLE tutor_follows (
    id BIGSERIAL PRIMARY KEY,
    student_user_id BIGINT NOT NULL,
    tutor_user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_tutor_follow UNIQUE (student_user_id, tutor_user_id),
    CONSTRAINT ck_tutor_follows_not_self CHECK (student_user_id <> tutor_user_id)
);

CREATE INDEX idx_tutor_follows_tutor ON tutor_follows(tutor_user_id);
