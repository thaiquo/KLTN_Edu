ALTER TABLE termination_case
    ADD CONSTRAINT uk_termination_case_signature UNIQUE (signature);
