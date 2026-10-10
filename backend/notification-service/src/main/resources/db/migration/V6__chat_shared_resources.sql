ALTER TABLE chat_messages
    ALTER COLUMN message_type TYPE VARCHAR(32),
    ADD COLUMN shared_resource_type VARCHAR(24),
    ADD COLUMN shared_resource_public_id UUID;

ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS ck_chat_messages_message_type,
    ADD CONSTRAINT ck_chat_messages_message_type
        CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO', 'SHARED_RESOURCE'));

ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS ck_chat_messages_attachment_state,
    ADD CONSTRAINT ck_chat_messages_attachment_state
        CHECK (
            (message_type IN ('TEXT', 'SHARED_RESOURCE') AND attachment_object_key IS NULL)
            OR message_type IN ('IMAGE', 'VIDEO')
        );

ALTER TABLE chat_messages
    ADD CONSTRAINT ck_chat_messages_shared_resource
        CHECK (
            (message_type = 'SHARED_RESOURCE'
                AND shared_resource_type IN ('CLASS', 'COMMUNITY_POST')
                AND shared_resource_public_id IS NOT NULL)
            OR
            (message_type <> 'SHARED_RESOURCE'
                AND shared_resource_type IS NULL
                AND shared_resource_public_id IS NULL)
        );

CREATE INDEX idx_chat_messages_shared_resource
    ON chat_messages(shared_resource_type, shared_resource_public_id)
    WHERE message_type = 'SHARED_RESOURCE';
