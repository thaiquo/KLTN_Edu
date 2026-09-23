CREATE TABLE tutor_reviews (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    tutor_id BIGINT NOT NULL,
    classroom_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    comment VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6),
    CONSTRAINT ck_tutor_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_tutor_reviews_comment_length CHECK (char_length(btrim(comment)) BETWEEN 10 AND 1000),
    CONSTRAINT uq_tutor_reviews_student_classroom UNIQUE (student_id, classroom_id)
);

CREATE INDEX idx_tutor_reviews_tutor ON tutor_reviews(tutor_id);
CREATE INDEX idx_tutor_reviews_classroom ON tutor_reviews(classroom_id);
CREATE INDEX idx_tutor_reviews_student ON tutor_reviews(student_id);
