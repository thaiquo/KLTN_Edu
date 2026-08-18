CREATE TABLE IF NOT EXISTS tutor_availabilities (
    id BIGSERIAL PRIMARY KEY,
    tutor_email VARCHAR(255) NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6)
);

CREATE INDEX idx_tutor_avail_email ON tutor_availabilities(lower(tutor_email));
