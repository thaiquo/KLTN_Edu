alter table certificates add column file_url varchar(2048);

update certificates
set file_url = file_key
where file_url is null;

alter table certificates alter column file_url set not null;
