CREATE UNIQUE INDEX uk_users_email_lower
    ON users (LOWER(email));
