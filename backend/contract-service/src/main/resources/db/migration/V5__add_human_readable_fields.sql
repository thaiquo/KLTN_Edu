-- V5__add_human_readable_fields.sql
-- Store human-readable student, tutor, and classroom info for contract display and legal agreements

ALTER TABLE contract_agreement ADD COLUMN IF NOT EXISTS student_email VARCHAR(255);
ALTER TABLE contract_agreement ADD COLUMN IF NOT EXISTS tutor_email VARCHAR(255);
ALTER TABLE contract_agreement ADD COLUMN IF NOT EXISTS student_name VARCHAR(255);
ALTER TABLE contract_agreement ADD COLUMN IF NOT EXISTS tutor_name VARCHAR(255);
ALTER TABLE contract_agreement ADD COLUMN IF NOT EXISTS class_name VARCHAR(500);
