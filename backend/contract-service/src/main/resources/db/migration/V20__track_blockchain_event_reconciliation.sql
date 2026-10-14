ALTER TABLE blockchain_transaction
    ADD COLUMN event_reconciled_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_blockchain_transaction_event_reconciliation
    ON blockchain_transaction(status, event_reconciled_at, updated_at);
