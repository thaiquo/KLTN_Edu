-- V43: Cho phép khảo sát đa lựa chọn (Multi-option poll votes) và cấu hình ca học (sessions_per_week, duration_minutes, max_votes_per_user)

ALTER TABLE post_polls
    ADD COLUMN IF NOT EXISTS sessions_per_week INT NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS max_votes_per_user INT NOT NULL DEFAULT 2;

-- Xóa ràng buộc cũ: 1 user chỉ vote duy nhất 1 option trên cả poll
ALTER TABLE post_poll_votes DROP CONSTRAINT IF EXISTS uq_user_poll_vote;

-- Thêm ràng buộc mới: 1 user không thể vote trùng 1 option, nhưng được vote nhiều option khác nhau
ALTER TABLE post_poll_votes DROP CONSTRAINT IF EXISTS uq_user_poll_option_vote;
ALTER TABLE post_poll_votes ADD CONSTRAINT uq_user_poll_option_vote UNIQUE (poll_id, user_id, option_id);
