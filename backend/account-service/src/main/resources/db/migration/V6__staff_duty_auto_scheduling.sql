ALTER TABLE staff_shift_assignments DROP CONSTRAINT ck_staff_shift_status;
ALTER TABLE staff_shift_assignments ADD CONSTRAINT ck_staff_shift_status
    CHECK (status IN ('DRAFT', 'ASSIGNED', 'CHECKED_IN', 'COMPLETED', 'ABSENT', 'SKIPPED'));

ALTER TABLE staff_shift_assignments DROP CONSTRAINT ck_staff_shift_assigned_fields;
ALTER TABLE staff_shift_assignments ADD CONSTRAINT ck_staff_shift_assigned_fields CHECK (
    status IN ('DRAFT', 'SKIPPED') OR (staff_id IS NOT NULL AND published_at IS NOT NULL)
);

ALTER TABLE staff_shift_assignments DROP CONSTRAINT ck_staff_shift_completed;
ALTER TABLE staff_shift_assignments ADD CONSTRAINT ck_staff_shift_completed CHECK (
    status NOT IN ('COMPLETED', 'ABSENT', 'SKIPPED') OR completed_at IS NOT NULL
);

ALTER TABLE staff_shift_audits DROP CONSTRAINT ck_staff_shift_audit_action;
ALTER TABLE staff_shift_audits ADD CONSTRAINT ck_staff_shift_audit_action CHECK (action IN (
    'CREATED', 'AUTO_ASSIGNED', 'MANUAL_ASSIGNED', 'PUBLISHED',
    'REASSIGNED', 'CHECKED_IN', 'COMPLETED', 'ABSENT', 'AUTO_SKIPPED'
));
