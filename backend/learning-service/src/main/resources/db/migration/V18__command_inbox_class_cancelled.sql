-- V18: Persist authoritative class_cancelled outcome in termination command inbox
ALTER TABLE learning_termination_command_inbox
    ADD COLUMN IF NOT EXISTS class_cancelled BOOLEAN NOT NULL DEFAULT FALSE;
