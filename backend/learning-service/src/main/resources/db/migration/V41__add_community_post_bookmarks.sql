ALTER TABLE post_interactions
    DROP CONSTRAINT ck_post_interactions_type,
    DROP CONSTRAINT ck_post_interactions_content,
    ADD CONSTRAINT ck_post_interactions_type
        CHECK (interaction_type IN ('LIKE', 'COMMENT', 'BOOKMARK')),
    ADD CONSTRAINT ck_post_interactions_content
        CHECK (
            (interaction_type IN ('LIKE', 'BOOKMARK') AND comment_text IS NULL)
            OR
            (interaction_type = 'COMMENT' AND NULLIF(BTRIM(comment_text), '') IS NOT NULL)
        );

CREATE UNIQUE INDEX uq_post_interactions_bookmark
    ON post_interactions (post_id, user_id)
    WHERE interaction_type = 'BOOKMARK';
