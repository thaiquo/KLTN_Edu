ALTER TABLE termination_case ADD COLUMN signer_wallet VARCHAR(42);
ALTER TABLE termination_case ADD COLUMN signature TEXT;
ALTER TABLE termination_case ADD COLUMN requested_at_timestamp BIGINT;
