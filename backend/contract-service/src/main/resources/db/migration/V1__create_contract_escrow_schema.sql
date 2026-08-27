CREATE TABLE contract_agreement (
    id UUID PRIMARY KEY,
    onchain_agreement_id VARCHAR(66),
    classroom_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    tutor_id BIGINT NOT NULL,
    classroom_reviewer_email VARCHAR(255),
    student_wallet VARCHAR(42) NOT NULL,
    tutor_wallet VARCHAR(42) NOT NULL,
    platform_wallet VARCHAR(42) NOT NULL,
    chain_id BIGINT,
    escrow_contract_address VARCHAR(42),
    token_address VARCHAR(42),
    token_symbol VARCHAR(20) NOT NULL DEFAULT 'USDC',
    token_decimals SMALLINT NOT NULL DEFAULT 6,
    terms_json TEXT NOT NULL,
    terms_hash VARCHAR(66) NOT NULL,
    contract_version INTEGER NOT NULL,
    total_price_vnd NUMERIC(19, 2) NOT NULL,
    vnd_per_usdc NUMERIC(19, 6) NOT NULL,
    total_amount_usdc_units NUMERIC(78, 0) NOT NULL,
    price_per_session_usdc_units NUMERIC(78, 0) NOT NULL,
    total_sessions INTEGER NOT NULL,
    payment_deadline TIMESTAMP WITH TIME ZONE,
    status VARCHAR(40) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_contract_agreement_business
        UNIQUE (classroom_id, student_id, contract_version),
    CONSTRAINT uq_contract_agreement_onchain UNIQUE (chain_id, onchain_agreement_id),
    CONSTRAINT ck_contract_agreement_amounts CHECK (
        total_price_vnd >= 0
        AND vnd_per_usdc > 0
        AND total_amount_usdc_units > 0
        AND price_per_session_usdc_units > 0
        AND total_sessions > 0
    ),
    CONSTRAINT ck_contract_agreement_token_decimals CHECK (token_decimals BETWEEN 0 AND 18)
);

CREATE TABLE contract_acceptance (
    id UUID PRIMARY KEY,
    agreement_id UUID NOT NULL REFERENCES contract_agreement(id),
    user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    terms_hash VARCHAR(66) NOT NULL,
    contract_version INTEGER NOT NULL,
    ip_address VARCHAR(64),
    user_agent VARCHAR(512),
    CONSTRAINT uq_contract_acceptance
        UNIQUE (agreement_id, user_id, role, contract_version)
);

CREATE TABLE escrow_payment (
    id UUID PRIMARY KEY,
    agreement_id UUID NOT NULL UNIQUE REFERENCES contract_agreement(id),
    chain_id BIGINT NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    escrow_contract_address VARCHAR(42) NOT NULL,
    expected_amount NUMERIC(78, 0) NOT NULL,
    approve_tx_hash VARCHAR(66),
    fund_tx_hash VARCHAR(66),
    confirmed_block_number BIGINT,
    confirmed_block_hash VARCHAR(66),
    status VARCHAR(40) NOT NULL,
    failure_reason TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_escrow_payment_amount CHECK (expected_amount > 0)
);

CREATE TABLE session_settlement (
    id UUID PRIMARY KEY,
    agreement_id UUID NOT NULL REFERENCES contract_agreement(id),
    session_id BIGINT NOT NULL,
    onchain_session_id VARCHAR(66) NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    dispute_deadline TIMESTAMP WITH TIME ZONE,
    status VARCHAR(40) NOT NULL,
    propose_tx_hash VARCHAR(66),
    finalize_tx_hash VARCHAR(66),
    proposal_evidence_hash VARCHAR(66),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_session_settlement_business UNIQUE (agreement_id, session_id),
    CONSTRAINT uq_session_settlement_onchain UNIQUE (agreement_id, onchain_session_id),
    CONSTRAINT ck_session_settlement_amount CHECK (amount > 0)
);

CREATE TABLE dispute (
    id UUID PRIMARY KEY,
    settlement_id UUID NOT NULL UNIQUE REFERENCES session_settlement(id),
    type VARCHAR(40) NOT NULL,
    complainant_id BIGINT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(40) NOT NULL,
    tutor_response TEXT,
    tutor_responded_at TIMESTAMP WITH TIME ZONE,
    resolution VARCHAR(20),
    resolution_reason TEXT,
    resolved_by_user_id BIGINT,
    resolved_by_email VARCHAR(255),
    resolved_by_role VARCHAR(20),
    resolved_at TIMESTAMP WITH TIME ZONE,
    open_tx_hash VARCHAR(66),
    resolve_tx_hash VARCHAR(66),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE dispute_evidence (
    id UUID PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES dispute(id),
    submitted_by_user_id BIGINT NOT NULL,
    submitted_by_role VARCHAR(20) NOT NULL,
    object_key VARCHAR(1024) NOT NULL,
    content_type VARCHAR(120),
    sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_dispute_evidence_object UNIQUE (dispute_id, object_key)
);

CREATE TABLE blockchain_transaction (
    id UUID PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    action VARCHAR(50) NOT NULL,
    chain_id BIGINT NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    calldata_hash VARCHAR(66) NOT NULL,
    transaction_hash VARCHAR(66),
    nonce NUMERIC(78, 0),
    agreement_id UUID,
    settlement_id UUID,
    receipt_status SMALLINT,
    block_number BIGINT,
    block_hash VARCHAR(66),
    status VARCHAR(30) NOT NULL,
    error_message TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_blockchain_transaction_hash UNIQUE (chain_id, transaction_hash),
    CONSTRAINT fk_blockchain_transaction_agreement
        FOREIGN KEY (agreement_id) REFERENCES contract_agreement(id),
    CONSTRAINT fk_blockchain_transaction_settlement
        FOREIGN KEY (settlement_id) REFERENCES session_settlement(id),
    CONSTRAINT ck_blockchain_transaction_attempt CHECK (attempt_count >= 0)
);

CREATE TABLE blockchain_event_cursor (
    id UUID PRIMARY KEY,
    chain_id BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    last_confirmed_block BIGINT NOT NULL,
    last_confirmed_block_hash VARCHAR(66),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_blockchain_event_cursor UNIQUE (chain_id, contract_address),
    CONSTRAINT ck_blockchain_event_cursor_block CHECK (last_confirmed_block >= 0)
);

CREATE TABLE outbox_event (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(120) NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    correlation_id VARCHAR(100),
    payload TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    CONSTRAINT ck_outbox_event_attempt CHECK (attempt_count >= 0)
);

CREATE TABLE processed_event (
    id UUID PRIMARY KEY,
    consumer_name VARCHAR(120) NOT NULL,
    event_id UUID NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_processed_event UNIQUE (consumer_name, event_id)
);

CREATE INDEX idx_contract_agreement_status ON contract_agreement(status);
CREATE INDEX idx_contract_agreement_student ON contract_agreement(student_id);
CREATE INDEX idx_contract_agreement_tutor ON contract_agreement(tutor_id);
CREATE INDEX idx_contract_agreement_reviewer ON contract_agreement(classroom_reviewer_email);
CREATE INDEX idx_escrow_payment_status ON escrow_payment(status);
CREATE INDEX idx_session_settlement_due ON session_settlement(status, dispute_deadline);
CREATE INDEX idx_dispute_status ON dispute(status);
CREATE INDEX idx_blockchain_transaction_dispatch
    ON blockchain_transaction(status, next_attempt_at, created_at);
CREATE INDEX idx_outbox_event_pending ON outbox_event(published_at, occurred_at);
