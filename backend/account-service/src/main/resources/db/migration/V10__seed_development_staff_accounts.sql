-- =====================================
-- DEVELOPMENT STAFF ACCOUNTS
-- =====================================
-- Stored passwords are BCrypt hashes generated with Spring Security BCryptPasswordEncoder.

WITH staff_seed(email, full_name, password_hash) AS (
    VALUES
        ('tanthinh@gmail.com', 'Tan Thinh', '$2a$10$K5SOFrLbhxEFzWKmSIcLUutXP4Kp4mQwzxIjmWW.MrXqwcuDEJ6H2'),
        ('quocthai@gmail.com', 'Quoc Thai', '$2a$10$K5SOFrLbhxEFzWKmSIcLUutXP4Kp4mQwzxIjmWW.MrXqwcuDEJ6H2'),
        ('tanquoc@gmail.com', 'Tan Quoc', '$2a$10$K5SOFrLbhxEFzWKmSIcLUutXP4Kp4mQwzxIjmWW.MrXqwcuDEJ6H2')
)
INSERT INTO users (
    email,
    password,
    full_name,
    email_verified,
    account_status,
    created_at,
    updated_at
)
SELECT
    seed.email,
    seed.password_hash,
    seed.full_name,
    TRUE,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM staff_seed seed
WHERE NOT EXISTS (
    SELECT 1
    FROM users existing_user
    WHERE LOWER(existing_user.email) = LOWER(seed.email)
);

UPDATE users target_user
SET
    password = seed.password_hash,
    full_name = seed.full_name,
    email_verified = TRUE,
    account_status = 'ACTIVE',
    updated_at = CURRENT_TIMESTAMP
FROM (
    VALUES
        ('tanthinh@gmail.com', 'Tan Thinh', '$2a$10$K5SOFrLbhxEFzWKmSIcLUutXP4Kp4mQwzxIjmWW.MrXqwcuDEJ6H2'),
        ('quocthai@gmail.com', 'Quoc Thai', '$2a$10$K5SOFrLbhxEFzWKmSIcLUutXP4Kp4mQwzxIjmWW.MrXqwcuDEJ6H2'),
        ('tanquoc@gmail.com', 'Tan Quoc', '$2a$10$K5SOFrLbhxEFzWKmSIcLUutXP4Kp4mQwzxIjmWW.MrXqwcuDEJ6H2')
) AS seed(email, full_name, password_hash)
WHERE LOWER(target_user.email) = LOWER(seed.email);

DELETE FROM user_roles role_row
USING users staff_user
WHERE role_row.user_id = staff_user.id
  AND LOWER(staff_user.email) IN (
      'tanthinh@gmail.com',
      'quocthai@gmail.com',
      'tanquoc@gmail.com'
  )
  AND role_row.role <> 'STAFF';

INSERT INTO user_roles (user_id, role)
SELECT staff_user.id, 'STAFF'
FROM users staff_user
WHERE LOWER(staff_user.email) IN (
    'tanthinh@gmail.com',
    'quocthai@gmail.com',
    'tanquoc@gmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;
