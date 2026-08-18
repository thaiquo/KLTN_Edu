ALTER TABLE tutor_documents
    DROP CONSTRAINT ck_tutor_documents_type;

ALTER TABLE tutor_documents
    ADD CONSTRAINT ck_tutor_documents_type
        CHECK (document_type IN (
            'IDENTITY_FRONT',
            'IDENTITY_BACK',
            'PASSPORT',
            'DEGREE',
            'CERTIFICATE',
            'WORK_EXPERIENCE',
            'PORTFOLIO',
            'OTHER'
        ));
