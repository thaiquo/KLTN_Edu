ALTER TABLE class_sessions ADD COLUMN meeting_link VARCHAR(500);

UPDATE class_sessions cs
SET meeting_link = (
    SELECT cr.meeting_link
    FROM class_rooms cr
    WHERE cr.id = cs.class_room_id
)
WHERE meeting_link IS NULL;
