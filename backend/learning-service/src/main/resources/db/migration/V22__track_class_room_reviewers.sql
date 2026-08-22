ALTER TABLE class_rooms
    ADD COLUMN IF NOT EXISTS reviewed_by_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_class_rooms_reviewed_by
    ON class_rooms(lower(reviewed_by_email), status)
    WHERE reviewed_by_email IS NOT NULL;
