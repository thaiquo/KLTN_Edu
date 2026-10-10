ALTER TABLE termination_case ADD COLUMN origin VARCHAR(40) NOT NULL DEFAULT 'PARTY_REQUEST';
ALTER TABLE termination_case ADD COLUMN response_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE termination_case ADD COLUMN tutor_responded_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX termination_case_response_deadline
    ON termination_case(status, response_deadline);
