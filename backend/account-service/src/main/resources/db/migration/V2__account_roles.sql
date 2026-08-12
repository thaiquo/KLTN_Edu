create table roles (
    id bigserial primary key,
    name varchar(32) not null unique
);

insert into roles (name) values
    ('STUDENT'),
    ('TUTOR'),
    ('STAFF'),
    ('ADMIN');

create table account_user_roles (
    id bigserial primary key,
    user_id uuid not null references accounts (id) on delete cascade,
    role_id bigint not null references roles (id),
    assigned_at timestamp not null,
    assigned_by uuid null references accounts (id) on delete set null,
    status varchar(16) not null,
    constraint uk_account_user_roles_user_role unique (user_id, role_id)
);

insert into account_user_roles (user_id, role_id, assigned_at, status)
select account.id, role.id, account.created_at, 'ACTIVE'
from accounts account
join roles role on role.name = account.role;

alter table accounts drop column role;

create index idx_account_user_roles_user_id on account_user_roles (user_id);
create index idx_account_user_roles_role_id on account_user_roles (role_id);
