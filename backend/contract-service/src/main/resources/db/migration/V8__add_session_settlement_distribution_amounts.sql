ALTER TABLE session_settlement ADD COLUMN tutor_amount NUMERIC(78, 0);
ALTER TABLE session_settlement ADD COLUMN platform_amount NUMERIC(78, 0);
ALTER TABLE session_settlement ADD COLUMN student_refund_amount NUMERIC(78, 0);
