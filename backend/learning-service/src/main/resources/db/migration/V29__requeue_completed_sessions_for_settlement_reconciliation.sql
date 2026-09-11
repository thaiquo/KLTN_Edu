-- V28's first delivery pass could acknowledge completed sessions before the
-- no-check-in rule was applied to every ACTIVE agreement. Requeue each completed
-- session once so the idempotent Contract Service can reconcile historical rows.
UPDATE class_sessions
SET settlement_dispatched = FALSE
WHERE status = 'COMPLETED';
