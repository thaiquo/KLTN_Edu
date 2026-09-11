-- Track whether session attendance has been delivered to contract-service for settlement.
-- Sessions that have already completed but not yet dispatched will be processed by the delivery service.
ALTER TABLE class_sessions ADD COLUMN settlement_dispatched BOOLEAN NOT NULL DEFAULT FALSE;
