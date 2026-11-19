-- Version follows the staff-duty auto-scheduling V6 already present on main.
ALTER TABLE support_ticket_history
    ADD COLUMN previous_assignee_user_id BIGINT REFERENCES users(id),
    ADD COLUMN new_assignee_user_id BIGINT REFERENCES users(id);

CREATE INDEX idx_support_ticket_history_assignee_change
    ON support_ticket_history(ticket_id, previous_assignee_user_id, new_assignee_user_id);
