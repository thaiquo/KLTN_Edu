-- Transaction-local on PostgreSQL; H2 PostgreSQL mode accepts set_config as a
-- compatibility no-op, so migration tests do not leak session lock settings.
SELECT set_config('lock_timeout', '5s', true);
SELECT set_config('statement_timeout', '60s', true);

ALTER TABLE class_rooms
    ADD COLUMN trial_policy_version SMALLINT;

ALTER TABLE class_rooms
    ADD CONSTRAINT ck_class_rooms_trial_policy_version
        CHECK (trial_policy_version IS NULL OR trial_policy_version > 0);

ALTER TABLE learning_termination_stop
    ADD COLUMN origin VARCHAR(40),
    ADD COLUMN effective_requested_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN command_id UUID,
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX uq_learning_termination_stop_command
    ON learning_termination_stop(command_id);
