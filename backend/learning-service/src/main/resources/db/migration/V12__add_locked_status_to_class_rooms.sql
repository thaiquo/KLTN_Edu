ALTER TABLE class_rooms DROP CONSTRAINT IF EXISTS ck_class_room_status;

ALTER TABLE class_rooms ADD CONSTRAINT ck_class_room_status 
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PRIVATE', 'PUBLISHED', 'LOCKED', 'REJECTED', 'CLOSED', 'CANCELLED'));
