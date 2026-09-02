-- The wallet is part of the legal identity snapshot used by both EIP-712 signers.
ALTER TABLE enrollment_requests
    ADD COLUMN IF NOT EXISTS student_wallet VARCHAR(42);

CREATE INDEX IF NOT EXISTS idx_enrollment_req_student_wallet
    ON enrollment_requests(student_wallet);
