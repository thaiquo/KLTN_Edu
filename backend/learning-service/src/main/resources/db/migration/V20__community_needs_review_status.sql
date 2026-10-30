ALTER TABLE community_posts
    DROP CONSTRAINT ck_community_moderation_status,
    ADD CONSTRAINT ck_community_moderation_status CHECK (moderation_status IN
        ('NOT_CHECKED', 'MODERATING', 'ALLOWED', 'NEEDS_EDIT', 'NEEDS_REVIEW', 'REJECTED', 'FAILED'));

ALTER TABLE community_post_pending_revisions
    DROP CONSTRAINT community_post_pending_revisions_moderation_status_check,
    ADD CONSTRAINT community_post_pending_revisions_moderation_status_check CHECK (moderation_status IN
        ('MODERATING', 'NEEDS_EDIT', 'NEEDS_REVIEW', 'REJECTED', 'FAILED'));
