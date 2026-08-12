CREATE TABLE tutor_teaching_profiles (
    id UUID PRIMARY KEY,
    tutor_id UUID NOT NULL UNIQUE,
    hourly_rate NUMERIC(12, 2) NOT NULL,
    teaching_mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_tutor_teaching_profiles_hourly_rate CHECK (hourly_rate >= 0)
);

CREATE TABLE tutor_teaching_profile_locations (
    tutor_teaching_profile_id UUID NOT NULL,
    location VARCHAR(255) NOT NULL,
    PRIMARY KEY (tutor_teaching_profile_id, location),
    CONSTRAINT fk_teaching_profile_locations_profile
        FOREIGN KEY (tutor_teaching_profile_id) REFERENCES tutor_teaching_profiles (id) ON DELETE CASCADE
);

CREATE TABLE tutor_availabilities (
    id UUID PRIMARY KEY,
    tutor_id UUID NOT NULL,
    day_of_week VARCHAR(10) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_tutor_availabilities_time CHECK (start_time < end_time),
    CONSTRAINT uq_tutor_availabilities_slot UNIQUE (tutor_id, day_of_week, start_time, end_time)
);

CREATE INDEX idx_tutor_availabilities_tutor ON tutor_availabilities (tutor_id);

CREATE TABLE tutor_availability_usages (
    id UUID PRIMARY KEY,
    availability_id UUID NOT NULL,
    resource_type VARCHAR(20) NOT NULL,
    resource_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_availability_usages_availability
        FOREIGN KEY (availability_id) REFERENCES tutor_availabilities (id) ON DELETE RESTRICT,
    CONSTRAINT uq_availability_usages_resource UNIQUE (availability_id, resource_type, resource_id)
);

CREATE INDEX idx_availability_usages_active
    ON tutor_availability_usages (availability_id, active);
