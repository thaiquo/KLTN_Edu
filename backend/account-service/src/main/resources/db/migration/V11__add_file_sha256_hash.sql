ALTER TABLE users
    ADD COLUMN avatar_sha256 VARCHAR(64);

ALTER TABLE tutor_documents
    ADD COLUMN sha256_hash VARCHAR(64);

CREATE INDEX idx_tutor_documents_app_sha256
    ON tutor_documents(tutor_application_id, sha256_hash);
