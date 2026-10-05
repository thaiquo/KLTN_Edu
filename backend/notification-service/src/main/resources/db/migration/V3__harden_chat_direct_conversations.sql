ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS participant_low_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS participant_high_user_id BIGINT;

UPDATE conversations
   SET participant_low_user_id = LEAST(participant1_id, participant2_id),
       participant_high_user_id = GREATEST(participant1_id, participant2_id)
 WHERE participant_low_user_id IS NULL
    OR participant_high_user_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM conversations
         GROUP BY participant_low_user_id, participant_high_user_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate direct chat conversations exist. Merge chat_messages by conversation_id before applying direct conversation uniqueness.';
    END IF;
END $$;

ALTER TABLE conversations
    ALTER COLUMN participant_low_user_id SET NOT NULL,
    ALTER COLUMN participant_high_user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_direct_pair
    ON conversations(participant_low_user_id, participant_high_user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_participant1_updated
    ON conversations(participant1_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_participant2_updated
    ON conversations(participant2_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created_id
    ON chat_messages(conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_recipient_unread
    ON chat_messages(conversation_id, recipient_id, is_read);
