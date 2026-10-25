#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash rehearse-restore-vps.sh /home/deploy/educonnect-backups/educonnect-YYYYMMDDTHHMMSSZ.dump" >&2
  exit 2
fi

backup_file=$(realpath -e -- "$1")
if [[ ! "$backup_file" == /home/deploy/educonnect-backups/educonnect-*.dump || ! -s "$backup_file" ]]; then
  echo 'Expected a non-empty EduConnect dump under /home/deploy/educonnect-backups.' >&2
  exit 2
fi

cd /opt/educonnect
sudo -v
restore_db="educonnect_restore_probe_$(date -u +%Y%m%dt%H%M%Sz)"
created=false

cleanup() {
  local result=$?
  trap - EXIT
  if [[ "$created" == true ]]; then
    echo "Removing isolated test database $restore_db"
    if ! sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
      'exec dropdb -U "$POSTGRES_USER" "$1"' sh "$restore_db"; then
      echo "Cleanup failed: remove only the isolated database $restore_db after checking it." >&2
      exit 1
    fi
  fi
  exit "$result"
}
trap cleanup EXIT

echo "Creating isolated test database $restore_db; live kltn_db is untouched."
sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
  'exec createdb -U "$POSTGRES_USER" "$1"' sh "$restore_db"
created=true

echo 'Restoring every archive object with error checking.'
sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
  'exec pg_restore --exit-on-error -U "$POSTGRES_USER" -d "$1"' sh "$restore_db" \
  < "$backup_file"

echo 'Checking restored reference data, empty business tables and migration histories.'
sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -P pager=off' sh "$restore_db" <<'SQL'
SELECT current_database() AS restored_database,
       pg_size_pretty(pg_database_size(current_database())) AS restored_size;

DO $$
BEGIN
  IF (SELECT count(*) FROM administrative_provinces) <> 34
     OR (SELECT count(*) FROM administrative_communes) <> 46
     OR (SELECT count(*) FROM subjects) <> 65
     OR (SELECT count(*) FROM catalog_subjects) <> 144
     OR (SELECT count(*) FROM catalog_levels) <> 667
     OR (SELECT count(*) FROM users) <> 0
     OR (SELECT count(*) FROM class_rooms) <> 0
     OR (SELECT count(*) FROM contract_agreement) <> 0
     OR (SELECT count(*) FROM blockchain_transaction) <> 0
     OR (SELECT count(*) FROM flyway_account_schema_history) <> 4
     OR (SELECT count(*) FROM flyway_learning_schema_history) <> 15
     OR (SELECT count(*) FROM flyway_contract_schema_history) <> 21
     OR (SELECT count(*) FROM flyway_notification_schema_history) <> 7 THEN
    RAISE EXCEPTION 'Restored database does not match the inspected 2026-10-23 snapshot';
  END IF;
END $$;

SELECT 'Snapshot row counts and Flyway histories match' AS result;
SQL

echo 'Isolated restore rehearsal passed. The test database will now be removed.'
