CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_id BIGINT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(64) NOT NULL,
    reference_type VARCHAR(64),
    reference_id VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'UNREAD',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    participant1_id BIGINT NOT NULL,
    participant1_email VARCHAR(255) NOT NULL,
    participant2_id BIGINT NOT NULL,
    participant2_email VARCHAR(255) NOT NULL,
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p1_email ON conversations(participant1_email);
CREATE INDEX IF NOT EXISTS idx_conversations_p2_email ON conversations(participant2_email);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    recipient_id BIGINT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages(recipient_id, is_read);
