CREATE TABLE community_post_reports (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    reporter_user_id BIGINT NOT NULL,
    reporter_role VARCHAR(20) NOT NULL,
    reason VARCHAR(80) NOT NULL,
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    resolved_by_user_id BIGINT,
    resolved_by_role VARCHAR(20),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_community_report_status CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED'))
);

CREATE UNIQUE INDEX uq_community_report_open_reporter
    ON community_post_reports(post_id, reporter_user_id)
    WHERE status = 'OPEN';
CREATE INDEX idx_community_report_queue ON community_post_reports(status, created_at DESC);

CREATE TABLE community_moderation_history (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    actor_user_id BIGINT NOT NULL,
    actor_email VARCHAR(255),
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(30) NOT NULL,
    previous_post_status VARCHAR(30),
    new_post_status VARCHAR(30),
    previous_moderation_status VARCHAR(20),
    new_moderation_status VARCHAR(20),
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_community_moderation_history ON community_moderation_history(post_id, created_at, id);
