-- V25: Add ENROLLED and EXPIRED statuses and agreement_id reference to enrollment_requests

ALTER TABLE enrollment_requests DROP CONSTRAINT IF EXISTS ck_enrollment_request_status;
ALTER TABLE enrollment_requests ADD CONSTRAINT ck_enrollment_request_status
    CHECK (status IN ('PENDING', 'ACCEPTED', 'ENROLLED', 'EXPIRED', 'REJECTED', 'CANCELLED'));

ALTER TABLE enrollment_requests ADD COLUMN IF NOT EXISTS agreement_id VARCHAR(36);
CREATE INDEX IF NOT EXISTS idx_enrollment_req_agreement_id ON enrollment_requests(agreement_id);
