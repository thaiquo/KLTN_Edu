#!/usr/bin/env bash
set -euo pipefail

mode=${1:-}
if [[ "$mode" != rehearse && "$mode" != apply ]]; then
  echo 'Usage: bash /home/deploy/seed-vps.sh rehearse|apply' >&2
  exit 2
fi

source_dir=/home/deploy/educonnect-seed-source
accounts_sql="$source_dir/development_accounts.sql"
users_sql="$source_dir/development_users.sql"
learning_sql="$source_dir/development_learning.sql"
backup_file=/home/deploy/educonnect-backups/educonnect-20261023T062234Z.dump
backup_sha=e4e3f300fb7ce1441182f2fb7e42a7887b32a3e4bc49cce579936e4d627bc1bb

for source_file in "$accounts_sql" "$users_sql" "$learning_sql" "$backup_file"; do
  test -s "$source_file" || { echo "Missing or empty: $source_file" >&2; exit 2; }
done
printf '%s  %s\n' "$backup_sha" "$backup_file" | sha256sum -c - >/dev/null

cd /opt/educonnect
sudo -v

test_database=''
credentials_partial=''
cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "$test_database" ]]; then
    echo "Removing isolated test database $test_database"
    if ! sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
      'exec dropdb -U "$POSTGRES_USER" "$1"' sh "$test_database"; then
      echo "Could not remove test database $test_database; inspect only this database before cleanup." >&2
      result=1
    fi
  fi
  if [[ -n "$credentials_partial" ]]; then
    rm -f -- "$credentials_partial"
  fi
  exit "$result"
}
trap cleanup EXIT

if [[ "$mode" == rehearse ]]; then
  target_database="educonnect_seed_probe_$(date -u +%Y%m%dt%H%M%Sz)"
  echo "Restoring pre-seed backup to isolated database $target_database"
  sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
    'exec createdb -U "$POSTGRES_USER" "$1"' sh "$target_database"
  test_database=$target_database
  sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
    'exec pg_restore --exit-on-error -U "$POSTGRES_USER" -d "$1"' sh "$target_database" \
    < "$backup_file"
else
  target_database=kltn_db
  echo 'This will insert demo accounts and classes into the live kltn_db (not financial data).'
  printf 'Type APPLY to continue: '
  read -r confirmation
  if [[ "$confirmation" != APPLY ]]; then
    echo 'Cancelled; live database unchanged.'
    exit 2
  fi
  umask 077
  credentials_file="/home/deploy/educonnect-backups/seed-credentials-$(date -u +%Y%m%dT%H%M%SZ).csv"
  credentials_partial="$credentials_file.partial"
  test ! -e "$credentials_file"
  test ! -e "$credentials_partial"
  install -m 600 /dev/null "$credentials_partial"
fi

stream_seed_sql() {
  cat <<'SQL'
\o /dev/null
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF (SELECT count(*) FROM users) <> 0
     OR (SELECT count(*) FROM students) <> 0
     OR (SELECT count(*) FROM tutors) <> 0
     OR (SELECT count(*) FROM class_rooms) <> 0
     OR (SELECT count(*) FROM class_sessions) <> 0
     OR (SELECT count(*) FROM contract_agreement) <> 0
     OR (SELECT count(*) FROM escrow_payment) <> 0
     OR (SELECT count(*) FROM blockchain_transaction) <> 0
     OR (SELECT count(*) FROM catalog_subjects) <> 144 THEN
    RAISE EXCEPTION 'Seed requires the inspected empty business database and migrated catalog';
  END IF;
END $$;
SQL

  sed -n '1,$p' "$accounts_sql"
  # Demo identities use a reserved non-deliverable domain, not real Gmail inboxes.
  sed -E \
    -e 's/(student[0-9]+|tutor[0-9]+)@gmail\.com/\1@demo.educonnect.invalid/g' \
    -e 's/(student[0-9]+|tutor[0-9]+%)@gmail\.com/\1@demo.educonnect.invalid/g' \
    "$users_sql"
  # Stop before the old completed sessions, attendance and reviews. Those rows
  # can trigger settlement delivery and are not needed for marketplace demos.
  sed -n '1,639p' "$learning_sql" |
    sed -E \
      -e 's/(student[0-9]+|tutor[0-9]+)@gmail\.com/\1@demo.educonnect.invalid/g' \
      -e "s/REPLACE\(email, '@gmail.com', ''\)/split_part(email, '@', 1)/g"

  cat <<'SQL'
CREATE TEMP TABLE seed_credentials AS
SELECT id, email, encode(gen_random_bytes(18), 'hex') AS plaintext_password
FROM users;

UPDATE users AS app_user
SET password = crypt(seed_credentials.plaintext_password, gen_salt('bf', 10)),
    updated_at = CURRENT_TIMESTAMP
FROM seed_credentials
WHERE app_user.id = seed_credentials.id;

DO $$
BEGIN
  RAISE NOTICE 'Seed counts: users=%, credentials=%, students=%, tutors=%, tutor_profiles=%, classes=%, published=%, sessions=%, agreements=%, payments=%, transactions=%',
    (SELECT count(*) FROM users),
    (SELECT count(*) FROM seed_credentials),
    (SELECT count(*) FROM students),
    (SELECT count(*) FROM tutors),
    (SELECT count(*) FROM tutor_profiles),
    (SELECT count(*) FROM class_rooms),
    (SELECT count(*) FROM class_rooms WHERE status = 'PUBLISHED'),
    (SELECT count(*) FROM class_sessions),
    (SELECT count(*) FROM contract_agreement),
    (SELECT count(*) FROM escrow_payment),
    (SELECT count(*) FROM blockchain_transaction);
  IF (SELECT count(*) FROM users) <> 49
     OR (SELECT count(*) FROM seed_credentials) <> 49
     OR (SELECT count(*) FROM students) <> 15
     OR (SELECT count(*) FROM tutors) <> 30
     OR (SELECT count(*) FROM tutor_profiles) <> 30
     OR (SELECT count(*) FROM class_rooms) <> 40
     OR (SELECT count(*) FROM class_rooms WHERE status = 'PUBLISHED') <> 10
     OR (SELECT count(*) FROM class_sessions) <> 0
     OR (SELECT count(*) FROM contract_agreement) <> 0
     OR (SELECT count(*) FROM escrow_payment) <> 0
     OR (SELECT count(*) FROM blockchain_transaction) <> 0 THEN
    RAISE EXCEPTION 'Seed row checks failed; transaction will be rolled back';
  END IF;
END $$;
\o
SELECT email || ',' || plaintext_password FROM seed_credentials ORDER BY email;
\o /dev/null
COMMIT;
SQL
}

if [[ "$mode" == rehearse ]]; then
  stream_seed_sql | sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
    'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"' sh "$target_database" \
    >/dev/null
  echo 'Seed rehearsal passed: 49 users, 15 students, 30 tutors/profiles, 40 classes (10 published), no sessions or financial rows.'
else
  stream_seed_sql | sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
    'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"' sh "$target_database" \
    > "$credentials_partial"
  test "$(wc -l < "$credentials_partial")" -eq 49
  mv -- "$credentials_partial" "$credentials_file"
  credentials_partial=''
  echo "Seed applied. One-time credentials are in $credentials_file (mode 600)."
  echo 'Do not paste that file into chat or commit it to Git.'
fi
