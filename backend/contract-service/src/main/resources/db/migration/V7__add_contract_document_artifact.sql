CREATE TABLE contract_document_artifact (
    id UUID PRIMARY KEY,
    agreement_id UUID NOT NULL REFERENCES contract_agreement(id),
    contract_version INTEGER NOT NULL,
    template_version VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL,
    docx_object_key VARCHAR(512),
    pdf_object_key VARCHAR(512),
    docx_sha256 VARCHAR(64),
    pdf_sha256 VARCHAR(64),
    docx_size BIGINT,
    pdf_size BIGINT,
    failure_code VARCHAR(64),
    failure_message VARCHAR(1000),
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_contract_document_artifact_version
        UNIQUE (agreement_id, contract_version),
    CONSTRAINT ck_contract_document_artifact_status
        CHECK (status IN ('GENERATING', 'READY', 'FAILED')),
    CONSTRAINT ck_contract_document_artifact_ready
        CHECK (status <> 'READY' OR (
            docx_object_key IS NOT NULL AND pdf_object_key IS NOT NULL
            AND docx_sha256 IS NOT NULL AND pdf_sha256 IS NOT NULL
            AND docx_size > 0 AND pdf_size > 0
        ))
);

CREATE INDEX idx_contract_document_artifact_agreement
    ON contract_document_artifact (agreement_id);
