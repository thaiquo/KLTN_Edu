ALTER TABLE class_rooms DROP CONSTRAINT IF EXISTS ck_class_room_status;

ALTER TABLE class_rooms ADD CONSTRAINT ck_class_room_status 
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PRIVATE', 'PUBLISHED', 'REJECTED', 'CLOSED', 'CANCELLED'));

ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS join_mode VARCHAR(30) NOT NULL DEFAULT 'OPEN_REQUEST';
ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS join_key VARCHAR(50);

ALTER TABLE class_rooms DROP CONSTRAINT IF EXISTS ck_class_room_join_mode;
ALTER TABLE class_rooms ADD CONSTRAINT ck_class_room_join_mode 
    CHECK (join_mode IN ('OPEN_REQUEST', 'INVITE_KEY'));
