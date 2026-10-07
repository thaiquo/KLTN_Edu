ALTER TABLE post_poll_options
    ADD COLUMN IF NOT EXISTS time_period VARCHAR(20);

UPDATE post_poll_options
SET time_period = CASE
    WHEN start_time < TIME '13:00' THEN 'MORNING'
    WHEN start_time < TIME '18:00' THEN 'AFTERNOON'
    ELSE 'EVENING'
END
WHERE time_period IS NULL;

ALTER TABLE post_poll_options
    ALTER COLUMN time_period SET NOT NULL;

ALTER TABLE post_poll_options
    DROP CONSTRAINT IF EXISTS ck_post_poll_options_time_period;

ALTER TABLE post_poll_options
    ADD CONSTRAINT ck_post_poll_options_time_period
        CHECK (time_period IN ('MORNING', 'AFTERNOON', 'EVENING'));

CREATE INDEX IF NOT EXISTS idx_post_poll_options_poll_day_period
    ON post_poll_options (poll_id, day_of_week, time_period);
