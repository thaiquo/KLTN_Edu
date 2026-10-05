CREATE TABLE IF NOT EXISTS chat_attachments (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL,
    object_key TEXT NOT NULL,
    original_name VARCHAR(255),
    content_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT fk_chat_attachments_message
        FOREIGN KEY (message_id)
        REFERENCES chat_messages(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id
    ON chat_attachments(message_id);

INSERT INTO chat_attachments (
    id,
    message_id,
    object_key,
    original_name,
    content_type,
    size,
    sha256,
    created_at
)
SELECT
    gen_random_uuid(),
    id,
    attachment_object_key,
    attachment_original_name,
    attachment_content_type,
    attachment_size,
    attachment_sha256,
    created_at
FROM chat_messages
WHERE message_type IN ('IMAGE', 'VIDEO')
  AND attachment_object_key IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM chat_attachments existing
      WHERE existing.message_id = chat_messages.id
        AND existing.object_key = chat_messages.attachment_object_key
  );

ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS ck_chat_messages_attachment_state;

ALTER TABLE chat_messages
    ADD CONSTRAINT ck_chat_messages_attachment_state
        CHECK (
            (message_type = 'TEXT' AND attachment_object_key IS NULL)
            OR message_type IN ('IMAGE', 'VIDEO')
        );
