ALTER TABLE contract_agreement ADD COLUMN termination_cutoff_session INTEGER;
ALTER TABLE contract_agreement ADD COLUMN termination_sessions_json TEXT;
CREATE TABLE termination_case (
    id UUID PRIMARY KEY,
    anchor_agreement_id UUID NOT NULL REFERENCES contract_agreement(id),
    classroom_id BIGINT NOT NULL,
    whole_class BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    status VARCHAR(40) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    audit_json TEXT NOT NULL,
    detection_key VARCHAR(255) UNIQUE,
    last_error TEXT,
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX termination_case_class ON termination_case(classroom_id, status);
CREATE TABLE termination_item (
    agreement_id UUID PRIMARY KEY REFERENCES contract_agreement(id),
    case_id UUID NOT NULL REFERENCES termination_case(id),
    status VARCHAR(40) NOT NULL,
    last_error TEXT,
    transaction_hash VARCHAR(66),
    refunded_units NUMERIC(78,0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX termination_item_case ON termination_item(case_id);

