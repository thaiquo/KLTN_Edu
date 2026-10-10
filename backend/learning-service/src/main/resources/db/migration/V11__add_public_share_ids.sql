ALTER TABLE class_rooms
    ADD COLUMN public_share_id UUID;

UPDATE class_rooms
SET public_share_id = gen_random_uuid()
WHERE public_share_id IS NULL;

ALTER TABLE class_rooms
    ALTER COLUMN public_share_id SET NOT NULL;

CREATE UNIQUE INDEX ux_class_rooms_public_share_id
    ON class_rooms(public_share_id);

ALTER TABLE community_posts
    ADD COLUMN public_share_id UUID;

UPDATE community_posts
SET public_share_id = gen_random_uuid()
WHERE public_share_id IS NULL;

ALTER TABLE community_posts
    ALTER COLUMN public_share_id SET NOT NULL;

CREATE UNIQUE INDEX ux_community_posts_public_share_id
    ON community_posts(public_share_id);
