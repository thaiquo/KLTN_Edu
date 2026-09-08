-- V6__add_phone_numbers.sql
-- Add phone number columns for tutor and student to store in contract agreements

ALTER TABLE contract_agreement ADD COLUMN IF NOT EXISTS student_phone VARCHAR(50);
ALTER TABLE contract_agreement ADD COLUMN IF NOT EXISTS tutor_phone VARCHAR(50);
