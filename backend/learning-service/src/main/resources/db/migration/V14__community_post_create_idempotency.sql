CREATE TABLE community_post_create_requests (
    author_id BIGINT NOT NULL,
    author_role VARCHAR(20) NOT NULL,
    request_token VARCHAR(64) NOT NULL,
    post_id BIGINT UNIQUE REFERENCES community_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (author_id, author_role, request_token)
);

