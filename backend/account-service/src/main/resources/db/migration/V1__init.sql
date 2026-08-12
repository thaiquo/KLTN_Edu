create table accounts (
    id uuid primary key,
    email varchar(255) not null unique,
    password_hash varchar(255) not null,
    role varchar(32) not null,
    status varchar(32) not null,
    email_verified_at timestamp null,
    last_login_at timestamp null,
    failed_login_count integer not null default 0,
    locked_until timestamp null,
    token_version bigint not null default 0,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp null
);

create table account_profiles (
    account_id uuid primary key references accounts (id) on delete cascade,
    full_name varchar(255) not null,
    phone varchar(30) null unique,
    avatar_url varchar(1024) null,
    created_at timestamp not null,
    updated_at timestamp not null
);

create table sessions (
    id uuid primary key,
    account_id uuid not null references accounts (id) on delete cascade,
    device_name varchar(255) null,
    browser varchar(255) null,
    os varchar(255) null,
    ip_address varchar(64) null,
    login_at timestamp not null,
    last_activity_at timestamp not null,
    status varchar(32) not null,
    revoked_at timestamp null,
    created_at timestamp not null,
    updated_at timestamp not null
);

create index idx_sessions_account_id on sessions (account_id);
create index idx_sessions_status on sessions (status);

create table refresh_tokens (
    id uuid primary key,
    account_id uuid not null references accounts (id) on delete cascade,
    session_id uuid not null references sessions (id) on delete cascade,
    family_id uuid not null,
    token_hash varchar(128) not null unique,
    expired_at timestamp not null,
    revoked boolean not null default false,
    revoked_at timestamp null,
    created_at timestamp not null,
    updated_at timestamp not null
);

create index idx_refresh_tokens_account_id on refresh_tokens (account_id);
create index idx_refresh_tokens_session_id on refresh_tokens (session_id);
create index idx_refresh_tokens_family_id on refresh_tokens (family_id);

create table verification_tokens (
    id uuid primary key,
    account_id uuid not null references accounts (id) on delete cascade,
    type varchar(32) not null,
    token_hash varchar(128) not null unique,
    expired_at timestamp not null,
    used_at timestamp null,
    status varchar(32) not null,
    created_at timestamp not null,
    updated_at timestamp not null
);

create index idx_verification_tokens_account_id on verification_tokens (account_id);
create index idx_verification_tokens_type on verification_tokens (type);

create table login_histories (
    id uuid primary key,
    account_id uuid null references accounts (id) on delete set null,
    attempted_email varchar(255) not null,
    success boolean not null,
    failure_reason varchar(255) null,
    ip_address varchar(64) null,
    user_agent varchar(512) null,
    login_time timestamp not null
);

create index idx_login_histories_account_id on login_histories (account_id);
create index idx_login_histories_login_time on login_histories (login_time);

create table security_audits (
    id uuid primary key,
    account_id uuid null references accounts (id) on delete set null,
    action varchar(64) not null,
    detail varchar(1000) null,
    ip_address varchar(64) null,
    created_at timestamp not null
);

create index idx_security_audits_account_id on security_audits (account_id);
create index idx_security_audits_action on security_audits (action);

create table outbox_events (
    id uuid primary key,
    aggregate_id uuid not null,
    aggregate_type varchar(128) not null,
    event_type varchar(128) not null,
    payload text not null,
    status varchar(32) not null,
    created_at timestamp not null,
    published_at timestamp null
);

create index idx_outbox_events_status on outbox_events (status);
create index idx_outbox_events_created_at on outbox_events (created_at);