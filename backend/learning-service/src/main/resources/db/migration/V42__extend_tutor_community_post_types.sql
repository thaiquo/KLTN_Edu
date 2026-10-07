ALTER TABLE community_posts
    DROP CONSTRAINT ck_community_posts_type,
    ADD CONSTRAINT ck_community_posts_type
        CHECK (post_type IN (
            'TUTOR_ANNOUNCEMENT',
            'TUTOR_POLL',
            'TUTOR_CLASS_SHARE',
            'STUDENT_FIND_TUTOR',
            'STUDENT_GROUP_STUDY'
        ));
