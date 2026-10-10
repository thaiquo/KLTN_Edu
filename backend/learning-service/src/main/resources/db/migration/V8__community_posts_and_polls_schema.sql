-- Compact community posts, polls, interactions, bookmarks, and multi-option voting schema.

CREATE TABLE community_posts (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL,
    author_role VARCHAR(20) NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    author_avatar VARCHAR(255),
    post_type VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    subject_id BIGINT REFERENCES subjects(id) ON DELETE SET NULL,
    education_level VARCHAR(50),
    learning_mode VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    target_price_per_session NUMERIC(15, 2),
    address TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    linked_class_id BIGINT REFERENCES class_rooms(id) ON DELETE SET NULL,
    like_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    view_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_community_posts_author_role
        CHECK (author_role IN ('STUDENT', 'TUTOR')),
    CONSTRAINT ck_community_posts_type
        CHECK (post_type IN (
            'TUTOR_ANNOUNCEMENT',
            'TUTOR_POLL',
            'TUTOR_CLASS_SHARE',
            'STUDENT_FIND_TUTOR',
            'STUDENT_GROUP_STUDY'
        )),
    CONSTRAINT ck_community_posts_learning_mode
        CHECK (learning_mode IN ('ONLINE', 'OFFLINE')),
    CONSTRAINT ck_community_posts_status
        CHECK (status IN ('OPEN', 'CONVERTED', 'CLOSED', 'HIDDEN')),
    CONSTRAINT ck_community_posts_target_price
        CHECK (target_price_per_session IS NULL OR target_price_per_session > 0),
    CONSTRAINT ck_community_posts_counts
        CHECK (like_count >= 0 AND comment_count >= 0 AND view_count >= 0)
);

CREATE TABLE post_interactions (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_avatar VARCHAR(255),
    interaction_type VARCHAR(20) NOT NULL,
    comment_text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_post_interactions_role
        CHECK (user_role IN ('STUDENT', 'TUTOR', 'STAFF', 'ADMIN')),
    CONSTRAINT ck_post_interactions_type
        CHECK (interaction_type IN ('LIKE', 'COMMENT', 'BOOKMARK')),
    CONSTRAINT ck_post_interactions_content
        CHECK (
            (interaction_type IN ('LIKE', 'BOOKMARK') AND comment_text IS NULL)
            OR
            (interaction_type = 'COMMENT' AND NULLIF(BTRIM(comment_text), '') IS NOT NULL)
        )
);

CREATE TABLE post_polls (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    question VARCHAR(255) NOT NULL,
    min_votes_target INT NOT NULL DEFAULT 10,
    expires_at TIMESTAMP,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    total_votes INT NOT NULL DEFAULT 0,
    sessions_per_week INT NOT NULL DEFAULT 2,
    duration_minutes INT NOT NULL DEFAULT 90,
    max_votes_per_user INT NOT NULL DEFAULT 2,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_post_polls_post UNIQUE (post_id),
    CONSTRAINT ck_post_polls_min_votes CHECK (min_votes_target > 0),
    CONSTRAINT ck_post_polls_total_votes CHECK (total_votes >= 0),
    CONSTRAINT ck_post_polls_sessions_per_week CHECK (sessions_per_week BETWEEN 1 AND 7),
    CONSTRAINT ck_post_polls_duration_minutes CHECK (duration_minutes > 0),
    CONSTRAINT ck_post_polls_max_votes_per_user CHECK (max_votes_per_user BETWEEN 1 AND 7)
);

CREATE TABLE post_poll_options (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    time_period VARCHAR(20) NOT NULL,
    option_label VARCHAR(150) NOT NULL,
    vote_count INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_post_poll_options_poll_slot UNIQUE (poll_id, day_of_week, start_time, end_time),
    CONSTRAINT uq_post_poll_options_poll_id_id UNIQUE (poll_id, id),
    CONSTRAINT ck_post_poll_options_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_post_poll_options_time CHECK (start_time < end_time),
    CONSTRAINT ck_post_poll_options_time_period
        CHECK (time_period IN ('MORNING', 'AFTERNOON', 'EVENING')),
    CONSTRAINT ck_post_poll_options_votes CHECK (vote_count >= 0)
);

CREATE TABLE post_poll_votes (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_poll_votes_option_poll
        FOREIGN KEY (poll_id, option_id)
        REFERENCES post_poll_options (poll_id, id)
        ON DELETE CASCADE,
    CONSTRAINT uq_user_poll_option_vote UNIQUE (poll_id, user_id, option_id)
);

CREATE INDEX idx_community_posts_status ON community_posts(status);
CREATE INDEX idx_community_posts_subject ON community_posts(subject_id);
CREATE INDEX idx_community_posts_type ON community_posts(post_type);
CREATE INDEX idx_community_posts_author ON community_posts(author_id, author_role);
CREATE INDEX idx_community_posts_created_at ON community_posts(created_at DESC);

CREATE INDEX idx_post_interactions_post_id ON post_interactions(post_id);
CREATE INDEX idx_post_interactions_user ON post_interactions(user_id, interaction_type);

CREATE UNIQUE INDEX uq_post_interactions_like
    ON post_interactions (post_id, user_id)
    WHERE interaction_type = 'LIKE';

CREATE UNIQUE INDEX uq_post_interactions_bookmark
    ON post_interactions (post_id, user_id)
    WHERE interaction_type = 'BOOKMARK';

CREATE INDEX idx_post_poll_options_poll_day_period
    ON post_poll_options (poll_id, day_of_week, time_period);

CREATE INDEX idx_post_poll_votes_user ON post_poll_votes(user_id);
CREATE INDEX idx_post_poll_votes_option ON post_poll_votes(option_id);
