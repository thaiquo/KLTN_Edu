ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS message_type VARCHAR(16) NOT NULL DEFAULT 'TEXT',
    ADD COLUMN IF NOT EXISTS attachment_object_key TEXT,
    ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS attachment_content_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
    ADD COLUMN IF NOT EXISTS attachment_sha256 VARCHAR(64);

ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS ck_chat_messages_message_type,
    ADD CONSTRAINT ck_chat_messages_message_type
        CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO'));

ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS ck_chat_messages_attachment_state,
    ADD CONSTRAINT ck_chat_messages_attachment_state
        CHECK (
            (message_type = 'TEXT' AND attachment_object_key IS NULL)
            OR
            (message_type IN ('IMAGE', 'VIDEO')
                AND attachment_object_key IS NOT NULL
                AND attachment_content_type IS NOT NULL
                AND attachment_size IS NOT NULL
                AND attachment_sha256 IS NOT NULL)
        );

CREATE INDEX IF NOT EXISTS idx_chat_messages_type
    ON chat_messages(message_type);
