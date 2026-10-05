-- Unique indexes introduced by V39 already cover these lookup prefixes.
DROP INDEX IF EXISTS idx_post_polls_post_id;
DROP INDEX IF EXISTS idx_post_poll_options_poll;
