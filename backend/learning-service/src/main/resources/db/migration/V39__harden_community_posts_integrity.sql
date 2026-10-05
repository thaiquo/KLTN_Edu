-- Enforce the Community aggregate invariants at the database boundary.

ALTER TABLE community_posts
    ADD CONSTRAINT ck_community_posts_author_role
        CHECK (author_role IN ('STUDENT', 'TUTOR')),
    ADD CONSTRAINT ck_community_posts_type
        CHECK (post_type IN ('TUTOR_POLL', 'STUDENT_FIND_TUTOR', 'STUDENT_GROUP_STUDY')),
    ADD CONSTRAINT ck_community_posts_learning_mode
        CHECK (learning_mode IN ('ONLINE', 'OFFLINE')),
    ADD CONSTRAINT ck_community_posts_status
        CHECK (status IN ('OPEN', 'CONVERTED', 'CLOSED', 'HIDDEN')),
    ADD CONSTRAINT ck_community_posts_target_price
        CHECK (target_price_per_session IS NULL OR target_price_per_session > 0),
    ADD CONSTRAINT ck_community_posts_counts
        CHECK (like_count >= 0 AND comment_count >= 0 AND view_count >= 0);

ALTER TABLE post_polls
    ADD CONSTRAINT uq_post_polls_post UNIQUE (post_id),
    ADD CONSTRAINT ck_post_polls_min_votes CHECK (min_votes_target > 0),
    ADD CONSTRAINT ck_post_polls_total_votes CHECK (total_votes >= 0);

ALTER TABLE post_poll_options
    ADD CONSTRAINT uq_post_poll_options_poll_slot UNIQUE (poll_id, day_of_week, start_time, end_time),
    ADD CONSTRAINT uq_post_poll_options_poll_id_id UNIQUE (poll_id, id),
    ADD CONSTRAINT ck_post_poll_options_day CHECK (day_of_week BETWEEN 1 AND 7),
    ADD CONSTRAINT ck_post_poll_options_time CHECK (start_time < end_time),
    ADD CONSTRAINT ck_post_poll_options_votes CHECK (vote_count >= 0);

ALTER TABLE post_poll_votes
    DROP CONSTRAINT post_poll_votes_option_id_fkey,
    ADD CONSTRAINT fk_post_poll_votes_option_poll
        FOREIGN KEY (poll_id, option_id)
        REFERENCES post_poll_options (poll_id, id)
        ON DELETE CASCADE;

ALTER TABLE post_interactions
    ADD CONSTRAINT ck_post_interactions_role
        CHECK (user_role IN ('STUDENT', 'TUTOR', 'STAFF', 'ADMIN')),
    ADD CONSTRAINT ck_post_interactions_type
        CHECK (interaction_type IN ('LIKE', 'COMMENT')),
    ADD CONSTRAINT ck_post_interactions_content
        CHECK (
            (interaction_type = 'LIKE' AND comment_text IS NULL)
            OR
            (interaction_type = 'COMMENT' AND NULLIF(BTRIM(comment_text), '') IS NOT NULL)
        );

CREATE UNIQUE INDEX uq_post_interactions_like
    ON post_interactions (post_id, user_id)
    WHERE interaction_type = 'LIKE';
