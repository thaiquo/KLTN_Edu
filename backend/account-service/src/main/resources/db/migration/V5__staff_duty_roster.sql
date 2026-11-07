CREATE TABLE staff_availability (
    id BIGSERIAL PRIMARY KEY,
    staff_id BIGINT NOT NULL REFERENCES users(id),
    work_date DATE NOT NULL,
    shift_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staff_availability_shift CHECK (shift_code IN ('MORNING', 'EVENING')),
    CONSTRAINT uk_staff_availability_slot UNIQUE (staff_id, work_date, shift_code)
);

CREATE TABLE staff_shift_assignments (
    id BIGSERIAL PRIMARY KEY,
    work_date DATE NOT NULL,
    shift_code VARCHAR(20) NOT NULL,
    staff_id BIGINT REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    check_in_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staff_shift_code CHECK (shift_code IN ('MORNING', 'EVENING')),
    CONSTRAINT ck_staff_shift_status CHECK (status IN ('DRAFT', 'ASSIGNED', 'CHECKED_IN', 'COMPLETED', 'ABSENT')),
    CONSTRAINT ck_staff_shift_assigned_fields CHECK (
        status = 'DRAFT' OR (staff_id IS NOT NULL AND published_at IS NOT NULL)
    ),
    CONSTRAINT ck_staff_shift_check_in CHECK (
        status NOT IN ('CHECKED_IN', 'COMPLETED') OR check_in_at IS NOT NULL
    ),
    CONSTRAINT ck_staff_shift_completed CHECK (
        status NOT IN ('COMPLETED', 'ABSENT') OR completed_at IS NOT NULL
    ),
    CONSTRAINT uk_staff_shift_slot UNIQUE (work_date, shift_code)
);

CREATE TABLE staff_shift_audits (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES staff_shift_assignments(id),
    action VARCHAR(30) NOT NULL,
    previous_staff_id BIGINT REFERENCES users(id),
    new_staff_id BIGINT REFERENCES users(id),
    changed_by BIGINT REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_staff_shift_audit_action CHECK (action IN (
        'CREATED', 'AUTO_ASSIGNED', 'MANUAL_ASSIGNED', 'PUBLISHED',
        'REASSIGNED', 'CHECKED_IN', 'COMPLETED', 'ABSENT'
    ))
);

CREATE INDEX idx_staff_availability_date ON staff_availability(work_date, shift_code);
CREATE INDEX idx_staff_shift_assignment_date ON staff_shift_assignments(work_date);
CREATE INDEX idx_staff_shift_assignment_staff_date ON staff_shift_assignments(staff_id, work_date);
CREATE INDEX idx_staff_shift_assignment_expiry ON staff_shift_assignments(status, work_date, shift_code);
CREATE INDEX idx_staff_shift_audit_assignment ON staff_shift_audits(assignment_id, created_at DESC);
