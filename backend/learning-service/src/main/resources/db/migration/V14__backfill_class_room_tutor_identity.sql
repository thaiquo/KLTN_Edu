DO $$
BEGIN
    IF to_regclass('public.users') IS NOT NULL
       AND to_regclass('public.tutor_profiles') IS NOT NULL THEN
        UPDATE class_rooms class_room
        SET
            tutor_profile_id = COALESCE(class_room.tutor_profile_id, tutor_profile.id),
            tutor_full_name = COALESCE(NULLIF(class_room.tutor_full_name, ''), account_user.full_name)
        FROM tutor_profiles tutor_profile
        JOIN users account_user ON account_user.id = tutor_profile.user_id
        WHERE lower(class_room.tutor_email) = lower(account_user.email)
          AND (
              class_room.tutor_profile_id IS NULL
              OR class_room.tutor_full_name IS NULL
              OR class_room.tutor_full_name = ''
          );
    END IF;
END $$;
