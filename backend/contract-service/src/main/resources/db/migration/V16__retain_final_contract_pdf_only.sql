ALTER TABLE contract_document_artifact
    DROP CONSTRAINT ck_contract_document_artifact_ready;

ALTER TABLE contract_document_artifact
    ADD CONSTRAINT ck_contract_document_artifact_ready
        CHECK (status <> 'READY' OR (
            pdf_object_key IS NOT NULL
            AND pdf_sha256 IS NOT NULL
            AND pdf_size > 0
        ));
