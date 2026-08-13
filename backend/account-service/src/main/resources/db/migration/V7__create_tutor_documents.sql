CREATE TABLE tutor_documents (
    id BIGSERIAL PRIMARY KEY,
    tutor_application_id BIGINT NOT NULL,
    document_type VARCHAR(40) NOT NULL,
    file_key VARCHAR(500) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    file_size BIGINT NOT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    uploaded_at TIMESTAMP(6) NOT NULL,
    title VARCHAR(160),
    issuer VARCHAR(160),
    issue_date DATE,
    validity_type VARCHAR(30),
    expiry_date DATE,
    credential_number VARCHAR(120),
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6),
    CONSTRAINT fk_tutor_documents_application
        FOREIGN KEY (tutor_application_id)
        REFERENCES tutor_applications (id)
        ON DELETE CASCADE,
    CONSTRAINT ck_tutor_documents_type
        CHECK (document_type IN ('IDENTITY_FRONT', 'IDENTITY_BACK', 'PASSPORT', 'DEGREE', 'CERTIFICATE')),
    CONSTRAINT ck_tutor_documents_verification_status
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    CONSTRAINT ck_tutor_documents_validity_type
        CHECK (validity_type IS NULL OR validity_type IN ('EXPIRES', 'DOES_NOT_EXPIRE')),
    CONSTRAINT ck_tutor_documents_expiry
        CHECK (
            validity_type IS NULL
            OR validity_type = 'DOES_NOT_EXPIRE'
            OR expiry_date IS NOT NULL
        ),
    CONSTRAINT ck_tutor_documents_file_size
        CHECK (file_size > 0)
);

CREATE INDEX idx_tutor_documents_application_id
    ON tutor_documents (tutor_application_id);

CREATE INDEX idx_tutor_documents_application_status
    ON tutor_documents (tutor_application_id, verification_status);
