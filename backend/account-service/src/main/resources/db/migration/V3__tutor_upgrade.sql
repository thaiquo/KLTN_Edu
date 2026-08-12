create table tutor_applications (
    id uuid primary key,
    user_id uuid not null references accounts (id),
    status varchar(32) not null,
    submitted_at timestamp null,
    reviewed_at timestamp null,
    reviewed_by uuid null references accounts (id),
    rejection_reason varchar(1000) null,
    created_at timestamp not null,
    updated_at timestamp not null
);

create index idx_tutor_applications_user_id on tutor_applications (user_id);
create index idx_tutor_applications_status on tutor_applications (status);

create table certificates (
    id uuid primary key,
    tutor_application_id uuid not null references tutor_applications (id) on delete cascade,
    name varchar(255) not null,
    issuer varchar(255) not null,
    issue_date date not null,
    expiry_date date null,
    file_url varchar(1024) not null,
    verification_status varchar(32) not null,
    created_at timestamp not null
);

create index idx_certificates_application_id on certificates (tutor_application_id);

create table tutor_profiles (
    id uuid primary key,
    user_id uuid not null unique references accounts (id),
    bio text null,
    experience_years integer not null default 0,
    verification_status varchar(32) not null,
    created_at timestamp not null,
    updated_at timestamp not null
);
