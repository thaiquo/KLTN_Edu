-- =====================================
-- DEVELOPMENT ADMIN ACCOUNT
-- =====================================
-- Stored password is a BCrypt hash generated with Spring Security BCryptPasswordEncoder.

WITH admin_seed(email, full_name, phone, password_hash) AS (
    VALUES
        (
            'ngocquocthai.004@gmail.com',
            'Huỳnh Ngọc Quốc Thái',
            '038705790',
            '$2a$10$BSpVj1b63nwZFTVMRjtgKOOF/JtZimoOMaj1Iz2Hb/avpzuXLEmwW'
        )
)
INSERT INTO users (
    email,
    password,
    full_name,
    phone,
    email_verified,
    account_status,
    created_at,
    updated_at
)
SELECT
    seed.email,
    seed.password_hash,
    seed.full_name,
    seed.phone,
    TRUE,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM admin_seed seed
WHERE NOT EXISTS (
    SELECT 1
    FROM users existing_user
    WHERE LOWER(existing_user.email) = LOWER(seed.email)
);

UPDATE users target_user
SET
    password = seed.password_hash,
    full_name = seed.full_name,
    phone = seed.phone,
    email_verified = TRUE,
    account_status = 'ACTIVE',
    updated_at = CURRENT_TIMESTAMP
FROM (
    VALUES
        (
            'ngocquocthai.004@gmail.com',
            'Huỳnh Ngọc Quốc Thái',
            '038705790',
            '$2a$10$BSpVj1b63nwZFTVMRjtgKOOF/JtZimoOMaj1Iz2Hb/avpzuXLEmwW'
        )
) AS seed(email, full_name, phone, password_hash)
WHERE LOWER(target_user.email) = LOWER(seed.email);

DELETE FROM user_roles role_row
USING users admin_user
WHERE role_row.user_id = admin_user.id
  AND LOWER(admin_user.email) = 'ngocquocthai.004@gmail.com'
  AND role_row.role <> 'ADMIN';

INSERT INTO user_roles (user_id, role)
SELECT admin_user.id, 'ADMIN'
FROM users admin_user
WHERE LOWER(admin_user.email) = 'ngocquocthai.004@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
