create table tutor_application_events (
    id uuid primary key,
    tutor_application_id uuid not null references tutor_applications (id) on delete cascade,
    actor_id uuid null references accounts (id),
    event_type varchar(64) not null,
    detail varchar(1000) null,
    created_at timestamp not null
);
create index idx_tutor_application_events_application_id on tutor_application_events (tutor_application_id, created_at);
