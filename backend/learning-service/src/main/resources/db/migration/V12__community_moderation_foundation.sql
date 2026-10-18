ALTER TABLE community_posts
    ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'NOT_CHECKED',
    ADD COLUMN content_revision BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN moderation_categories TEXT,
    ADD COLUMN moderation_reason VARCHAR(500),
    ADD COLUMN moderation_prompt_version VARCHAR(100),
    ADD COLUMN moderated_at TIMESTAMP,
    ADD CONSTRAINT ck_community_moderation_status CHECK (moderation_status IN
        ('NOT_CHECKED', 'MODERATING', 'ALLOWED', 'NEEDS_EDIT', 'REJECTED', 'FAILED')),
    ADD CONSTRAINT ck_community_content_revision CHECK (content_revision > 0);
