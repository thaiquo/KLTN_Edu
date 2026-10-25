#!/usr/bin/env bash
set -euo pipefail

cd /opt/educonnect
sudo -v

echo '=== Release and containers ==='
grep '^RELEASE_TAG=' .env
sudo docker compose -f compose.vps.yaml ps

echo '=== Database inventory (read only) ==='
sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<'SQL'
SELECT current_database() AS database_name,
       pg_size_pretty(pg_database_size(current_database())) AS database_size;

SELECT 'users' AS item, count(*) AS rows FROM users
UNION ALL SELECT 'students', count(*) FROM students
UNION ALL SELECT 'tutors', count(*) FROM tutors
UNION ALL SELECT 'administrative_provinces', count(*) FROM administrative_provinces
UNION ALL SELECT 'administrative_communes', count(*) FROM administrative_communes
UNION ALL SELECT 'subjects', count(*) FROM subjects
UNION ALL SELECT 'catalog_subjects', count(*) FROM catalog_subjects
UNION ALL SELECT 'catalog_levels', count(*) FROM catalog_levels
UNION ALL SELECT 'class_rooms', count(*) FROM class_rooms
UNION ALL SELECT 'class_sessions', count(*) FROM class_sessions
UNION ALL SELECT 'contract_agreement', count(*) FROM contract_agreement
UNION ALL SELECT 'escrow_payment', count(*) FROM escrow_payment
UNION ALL SELECT 'blockchain_transaction', count(*) FROM blockchain_transaction
ORDER BY item;

SELECT 'account' AS service, count(*) AS migrations,
       count(*) FILTER (WHERE NOT success) AS failed
FROM flyway_account_schema_history
UNION ALL SELECT 'learning', count(*), count(*) FILTER (WHERE NOT success)
FROM flyway_learning_schema_history
UNION ALL SELECT 'contract', count(*), count(*) FILTER (WHERE NOT success)
FROM flyway_contract_schema_history
UNION ALL SELECT 'notification', count(*), count(*) FILTER (WHERE NOT success)
FROM flyway_notification_schema_history;
SQL

echo '=== Host capacity ==='
free -h
df -h /
