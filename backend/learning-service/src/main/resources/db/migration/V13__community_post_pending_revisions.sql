CREATE TABLE community_post_pending_revisions (
    post_id BIGINT PRIMARY KEY REFERENCES community_posts(id) ON DELETE CASCADE,
    content_revision BIGINT NOT NULL CHECK (content_revision > 0),
    request_json TEXT NOT NULL,
    moderation_status VARCHAR(20) NOT NULL CHECK (moderation_status IN
        ('MODERATING', 'NEEDS_EDIT', 'REJECTED', 'FAILED')),
    moderation_categories TEXT,
    moderation_reason VARCHAR(500),
    moderation_prompt_version VARCHAR(100),
    moderated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
