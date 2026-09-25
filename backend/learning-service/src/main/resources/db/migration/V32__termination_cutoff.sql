ALTER TABLE class_rooms ADD COLUMN termination_cutoff_session INTEGER;
CREATE TABLE learning_termination_stop (
    agreement_id VARCHAR(36) PRIMARY KEY,
    classroom_id BIGINT NOT NULL REFERENCES class_rooms(id),
    student_id BIGINT NOT NULL,
    cutoff_session INTEGER NOT NULL,
    closed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX learning_termination_student ON learning_termination_stop(classroom_id, student_id);
