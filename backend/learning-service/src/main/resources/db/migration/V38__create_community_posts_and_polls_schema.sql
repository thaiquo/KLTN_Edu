-- V38__create_community_posts_and_polls_schema.sql
-- Migration for Community Feed, Polling, and Matching System in EduConnect

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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_posts_status ON community_posts(status);
CREATE INDEX idx_community_posts_subject ON community_posts(subject_id);
CREATE INDEX idx_community_posts_type ON community_posts(post_type);
CREATE INDEX idx_community_posts_author ON community_posts(author_id, author_role);
CREATE INDEX idx_community_posts_created_at ON community_posts(created_at DESC);

CREATE TABLE post_polls (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    question VARCHAR(255) NOT NULL,
    min_votes_target INT NOT NULL DEFAULT 5,
    expires_at TIMESTAMP,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    total_votes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_polls_post_id ON post_polls(post_id);

CREATE TABLE post_poll_options (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    option_label VARCHAR(150) NOT NULL,
    vote_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_post_poll_options_poll ON post_poll_options(poll_id);

CREATE TABLE post_poll_votes (
    id BIGSERIAL PRIMARY KEY,
    poll_id BIGINT NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL REFERENCES post_poll_options(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_poll_vote UNIQUE (poll_id, user_id)
);

CREATE INDEX idx_post_poll_votes_user ON post_poll_votes(user_id);
CREATE INDEX idx_post_poll_votes_option ON post_poll_votes(option_id);

CREATE TABLE post_interactions (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_avatar VARCHAR(255),
    interaction_type VARCHAR(20) NOT NULL,
    comment_text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_post_interactions_post_id ON post_interactions(post_id);
CREATE INDEX idx_post_interactions_user ON post_interactions(user_id, interaction_type);
