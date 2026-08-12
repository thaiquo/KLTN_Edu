alter table certificates rename column file_url to file_key;

alter table certificates
    add column original_file_name varchar(255),
    add column content_type varchar(100),
    add column file_size bigint;

update certificates
set original_file_name = file_key,
    content_type = 'application/octet-stream',
    file_size = 0
where original_file_name is null;

alter table certificates
    alter column original_file_name set not null,
    alter column content_type set not null,
    alter column file_size set not null;

alter table certificates
    add constraint chk_certificates_file_size check (file_size >= 0);
