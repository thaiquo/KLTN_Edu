create table tutor_application_subjects (
    id uuid primary key,
    tutor_application_id uuid not null references tutor_applications (id) on delete cascade,
    level_group varchar(64) not null,
    subject_name varchar(255) not null,
    teaching_level varchar(128) not null,
    bio text not null,
    experience text not null
);

create index idx_tutor_application_subjects_application_id on tutor_application_subjects (tutor_application_id);
alter table certificates add column teaching_subject_id uuid null references tutor_application_subjects (id) on delete cascade;
create index idx_certificates_teaching_subject_id on certificates (teaching_subject_id);
