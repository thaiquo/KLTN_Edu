CREATE TABLE termination_evidence (
    id UUID PRIMARY KEY,
    termination_case_id UUID NOT NULL REFERENCES termination_case(id) ON DELETE CASCADE,
    submitted_by_user_id BIGINT NOT NULL,
    submitted_by_role VARCHAR(20) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    object_key VARCHAR(1024) NOT NULL UNIQUE,
    content_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX termination_evidence_case_created
    ON termination_evidence(termination_case_id, created_at);
