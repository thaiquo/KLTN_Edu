-- V36: Classroom materials (class level) and session files (session level: max 5 assignments + materials)
-- Plus homework submission metadata and syllabus file metadata

-- 1. Classroom Materials (Tài liệu môn học cấp lớp - học viên tải không cần điểm danh)
CREATE TABLE IF NOT EXISTS classroom_materials (
    id BIGSERIAL PRIMARY KEY,
    class_room_id BIGINT NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    external_url VARCHAR(1000),
    file_name VARCHAR(255) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_size BIGINT,
    content_type VARCHAR(100),
    uploaded_by_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6)
);

CREATE INDEX IF NOT EXISTS idx_classroom_materials_class_room_id ON classroom_materials(class_room_id);

-- 2. Session Files (Tài liệu và Đề bài tập từng buổi - tối đa 5 file bài tập)
CREATE TABLE IF NOT EXISTS session_files (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    file_category VARCHAR(30) NOT NULL, -- 'ASSIGNMENT' | 'MATERIAL'
    file_name VARCHAR(255) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_size BIGINT,
    content_type VARCHAR(100),
    file_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_session_file_category CHECK (file_category IN ('ASSIGNMENT', 'MATERIAL'))
);

CREATE INDEX IF NOT EXISTS idx_session_files_session_id ON session_files(session_id);
CREATE INDEX IF NOT EXISTS idx_session_files_session_category ON session_files(session_id, file_category);

-- 3. Session Attendances: thêm metadata cho file bài làm của học viên
ALTER TABLE session_attendances
    ADD COLUMN IF NOT EXISTS submission_file_key VARCHAR(500),
    ADD COLUMN IF NOT EXISTS submission_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS submission_file_size BIGINT,
    ADD COLUMN IF NOT EXISTS submission_content_type VARCHAR(100);

-- 4. Class Rooms: thêm metadata cho file lộ trình môn học (Syllabus)
ALTER TABLE class_rooms
    ADD COLUMN IF NOT EXISTS syllabus_file_key VARCHAR(500),
    ADD COLUMN IF NOT EXISTS syllabus_file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS syllabus_file_size BIGINT,
    ADD COLUMN IF NOT EXISTS syllabus_content_type VARCHAR(100);

-- 5. Class Sessions: thêm link ngoài bổ sung (Google Drive / link phụ trợ)
ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS assignment_external_url VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS material_external_url VARCHAR(1000);
