-- Normalize legacy references that used tutors.id where the learning domain
-- expects the canonical tutor_profiles.id.

UPDATE tutor_authorization_states state
SET tutor_profile_id = profile.id
FROM tutor_profiles profile
WHERE profile.user_id = state.user_id
  AND state.tutor_profile_id IS DISTINCT FROM profile.id;

UPDATE tutor_subject_registrations registration
SET tutor_profile_id = profile.id
FROM users account_user
JOIN tutor_profiles profile ON profile.user_id = account_user.id
WHERE LOWER(registration.tutor_email) = LOWER(account_user.email)
  AND registration.tutor_profile_id IS DISTINCT FROM profile.id;

UPDATE class_rooms classroom
SET tutor_profile_id = profile.id
FROM users account_user
JOIN tutor_profiles profile ON profile.user_id = account_user.id
WHERE LOWER(classroom.tutor_email) = LOWER(account_user.email)
  AND classroom.tutor_profile_id IS DISTINCT FROM profile.id;
