CREATE TABLE support_tickets (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    creator_user_id BIGINT NOT NULL REFERENCES users(id),
    creator_role VARCHAR(20) NOT NULL,
    category VARCHAR(30) NOT NULL,
    subject VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    assignee_user_id BIGINT REFERENCES users(id),
    escalated_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_support_ticket_creator_role CHECK (creator_role IN ('STUDENT', 'TUTOR')),
    CONSTRAINT ck_support_ticket_status CHECK (status IN
        ('OPEN', 'ASSIGNED', 'WAITING_USER', 'WAITING_STAFF', 'ESCALATED', 'RESOLVED', 'CLOSED')),
    CONSTRAINT ck_support_ticket_category CHECK (category IN
        ('ACCOUNT', 'TUTOR_PROFILE', 'CLASS', 'CONTRACT', 'PAYMENT', 'COMMUNITY', 'TECHNICAL', 'OTHER'))
);

CREATE TABLE support_ticket_messages (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    actor_user_id BIGINT NOT NULL REFERENCES users(id),
    actor_role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE support_ticket_history (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    actor_user_id BIGINT NOT NULL REFERENCES users(id),
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(40) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_ticket_creator ON support_tickets(creator_user_id, created_at DESC);
CREATE INDEX idx_support_ticket_staff_queue ON support_tickets(status, assignee_user_id, updated_at DESC);
CREATE INDEX idx_support_ticket_messages ON support_ticket_messages(ticket_id, created_at, id);
CREATE INDEX idx_support_ticket_history ON support_ticket_history(ticket_id, created_at, id);
