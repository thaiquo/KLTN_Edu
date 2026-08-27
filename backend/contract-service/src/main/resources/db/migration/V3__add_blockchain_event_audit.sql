ALTER TABLE blockchain_event_cursor
    DROP CONSTRAINT ck_blockchain_event_cursor_block;

ALTER TABLE blockchain_event_cursor
    ADD CONSTRAINT ck_blockchain_event_cursor_block CHECK (last_confirmed_block >= -1);

ALTER TABLE processed_event
    ADD COLUMN chain_id BIGINT;

ALTER TABLE processed_event
    ADD COLUMN contract_address VARCHAR(42);

ALTER TABLE processed_event
    ADD COLUMN transaction_hash VARCHAR(66);

ALTER TABLE processed_event
    ADD COLUMN log_index BIGINT;

ALTER TABLE processed_event
    ADD COLUMN block_number BIGINT;

ALTER TABLE processed_event
    ADD COLUMN block_hash VARCHAR(66);

ALTER TABLE processed_event
    ADD COLUMN decoded_payload TEXT;

ALTER TABLE processed_event
    ADD CONSTRAINT uq_processed_blockchain_log
        UNIQUE (chain_id, transaction_hash, log_index);

ALTER TABLE processed_event
    ADD CONSTRAINT ck_processed_blockchain_log_index
        CHECK (log_index IS NULL OR log_index >= 0);

CREATE INDEX idx_processed_blockchain_block
    ON processed_event(chain_id, contract_address, block_number);
