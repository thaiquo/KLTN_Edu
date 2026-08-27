ALTER TABLE blockchain_transaction
    ADD COLUMN calldata TEXT;

ALTER TABLE blockchain_transaction
    ADD COLUMN signed_raw_transaction TEXT;

ALTER TABLE blockchain_transaction
    ADD COLUMN dispatch_started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE blockchain_transaction
    ADD CONSTRAINT ck_blockchain_transaction_calldata
        CHECK (calldata IS NULL OR calldata LIKE '0x%');

