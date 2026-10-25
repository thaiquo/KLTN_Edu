#!/usr/bin/env bash
set -euo pipefail

cd /opt/educonnect
sudo -v
umask 077
backup_dir=/home/deploy/educonnect-backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/educonnect-$timestamp.dump"
partial_file="$backup_file.partial"

install -d -m 700 "$backup_dir"
test ! -e "$backup_file"
test ! -e "$partial_file"
install -m 600 /dev/null "$partial_file"
trap 'rm -f "$partial_file"' EXIT

echo "Writing PostgreSQL backup to $backup_file"
sudo docker compose -f compose.vps.yaml exec -T postgres sh -c \
  'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "$partial_file"

echo 'Checking that the dump is readable:'
sudo docker compose -f compose.vps.yaml exec -T postgres pg_restore -l \
  < "$partial_file" >/dev/null
test -s "$partial_file"
mv "$partial_file" "$backup_file"
ls -lh "$backup_file"
echo 'Backup catalogue readable. Full restore rehearsal is still required.'
