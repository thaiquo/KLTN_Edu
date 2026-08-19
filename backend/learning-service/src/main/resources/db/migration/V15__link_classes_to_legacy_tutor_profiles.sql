UPDATE tutor_subject_registrations registration
SET tutor_profile_id = tutor.id
FROM tutors tutor
JOIN users account_user ON account_user.id = tutor.user_id
WHERE lower(registration.tutor_email) = lower(account_user.email)
  AND registration.tutor_profile_id IS NULL;

UPDATE class_rooms class_room
SET
    tutor_profile_id = tutor.id,
    tutor_full_name = account_user.full_name
FROM tutors tutor
JOIN users account_user ON account_user.id = tutor.user_id
WHERE lower(class_room.tutor_email) = lower(account_user.email)
  AND (
      class_room.tutor_profile_id IS NULL
      OR class_room.tutor_full_name IS NULL
      OR class_room.tutor_full_name = ''
  );
