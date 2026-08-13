CREATE TABLE subject_suggestions (
    id BIGSERIAL PRIMARY KEY,
    suggested_by BIGINT NOT NULL,
    suggested_name VARCHAR(160) NOT NULL,
    category_id BIGINT NOT NULL,
    group_id BIGINT NOT NULL,
    note VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP(6),
    rejection_reason VARCHAR(1000),
    approved_subject_id BIGINT,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_subject_suggestions_user
        FOREIGN KEY (suggested_by)
        REFERENCES users (id),
    CONSTRAINT fk_subject_suggestions_category
        FOREIGN KEY (category_id)
        REFERENCES subject_categories (id),
    CONSTRAINT fk_subject_suggestions_group
        FOREIGN KEY (group_id)
        REFERENCES subject_groups (id),
    CONSTRAINT fk_subject_suggestions_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES users (id),
    CONSTRAINT fk_subject_suggestions_approved_subject
        FOREIGN KEY (approved_subject_id)
        REFERENCES subjects (id),
    CONSTRAINT ck_subject_suggestions_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE TABLE subject_suggestion_levels (
    subject_suggestion_id BIGINT NOT NULL,
    level VARCHAR(40) NOT NULL,
    CONSTRAINT pk_subject_suggestion_levels
        PRIMARY KEY (subject_suggestion_id, level),
    CONSTRAINT fk_subject_suggestion_levels_suggestion
        FOREIGN KEY (subject_suggestion_id)
        REFERENCES subject_suggestions (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_subject_suggestion_levels_level
        CHECK (level IN ('PRIMARY', 'LOWER_SECONDARY', 'UPPER_SECONDARY', 'UNIVERSITY', 'ADULT', 'EXAM_PREPARATION'))
);

CREATE INDEX idx_subject_suggestions_status
    ON subject_suggestions (status);

CREATE INDEX idx_subject_suggestions_user
    ON subject_suggestions (suggested_by);

CREATE INDEX idx_subject_suggestions_group
    ON subject_suggestions (group_id);
