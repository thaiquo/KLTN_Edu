#!/usr/bin/env bash
# Install once as /usr/local/sbin/educonnect-release, owned by root.
set -Eeuo pipefail
umask 077

base=/opt/educonnect
incoming=/home/deploy/educonnect-incoming
state="$base/.release-state"
backup_dir=/var/backups/educonnect
services=(account-service learning-service contract-service notification-service api-gateway frontend-web ai-service)
all_services=(postgres rabbitmq gotenberg account-service learning-service contract-service notification-service api-gateway frontend-web caddy qdrant ai-service)

die() { printf 'Release error: %s\n' "$*" >&2; exit 1; }
log() { printf 'Release: %s\n' "$*"; }
valid_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }

[[ $(id -u) -eq 0 ]] || die 'run through sudo as root'
[[ $# -eq 2 ]] || die 'usage: educonnect-release check|deploy FULL_GIT_SHA, or rollback FULL_GIT_SHA|baseline'
operation=$1
target=$2
[[ "$operation" == check || "$operation" == deploy || "$operation" == rollback ]] || die 'invalid operation'
if [[ "$target" != baseline ]]; then
  valid_sha "$target" || die 'release must be a full lowercase Git SHA'
else
  [[ "$operation" == rollback ]] || die 'baseline is only valid for rollback'
fi

exec 9>/run/lock/educonnect-release.lock
flock -n 9 || die 'another release is running'
[[ -f "$base/.env" ]] || die 'production .env is missing'
[[ -f "$base/compose.vps.yaml" && -f "$base/deploy/Caddyfile" ]] || die 'current deployment files are missing'
command -v docker >/dev/null || die 'Docker is unavailable'
command -v curl >/dev/null || die 'curl is unavailable'
command -v flock >/dev/null || die 'flock is unavailable'
available_kb=$(df -Pk "$base" | awk 'NR == 2 {print $4}')
[[ "$available_kb" =~ ^[0-9]+$ && "$available_kb" -ge 3145728 ]] || die 'less than 3 GiB free on the VPS; release stopped before pulling images'
grep -Eq '^BLOCKCHAIN_ENABLED=true[[:space:]]*$' "$base/.env" || die 'blockchain must remain enabled in production .env'
grep -Eq '^BLOCKCHAIN_OPERATOR_ENABLED=true[[:space:]]*$' "$base/.env" || die 'operator must remain enabled in production .env'
grep -Eq '^BLOCKCHAIN_OPERATOR_ADDRESS=0x[0-9A-Fa-f]{40}[[:space:]]*$' "$base/.env" || die 'operator address is missing or invalid in production .env'
grep -Eq '^BLOCKCHAIN_OPERATOR_PRIVATE_KEY=.+$' "$base/.env" || die 'operator private key is missing from production .env'
cd "$base"
install -d -m 700 "$state" "$state/snapshots" "$backup_dir"

read_tag() {
  sed -n 's/^RELEASE_TAG=//p' "$1" | head -n 1 | tr -d '\r'
}
current_file="$base/release.env"
if [[ ! -f "$current_file" ]]; then
  current_tag=$(read_tag "$base/.env")
  valid_sha "$current_tag" || die 'set RELEASE_TAG to the currently running full SHA in production .env first'
  printf 'RELEASE_TAG=%s\n' "$current_tag" > "$current_file"
  chmod 600 "$current_file"
fi
current_tag=$(read_tag "$current_file")
valid_sha "$current_tag" || die 'current release.env contains an invalid SHA'

extra_files=()
compose() {
  docker compose --env-file "$base/.env" --env-file "$candidate_file" \
    --profile ai -f "$base/compose.vps.yaml" "${extra_files[@]}" "$@"
}
running_image() {
  local container
  container=$(compose ps -q "$1")
  [[ -n "$container" ]] || die "$1 is not running"
  docker inspect --format '{{.Config.Image}}' "$container"
}
stored_baseline_image() {
  awk -v service="$1:" '$1 == service {getline; print $2; exit}' "$state/baseline/images.yaml"
}
verify_running_images() {
  local service image expected
  for service in "${services[@]}"; do
    image=$(running_image "$service")
    if [[ -f "$state/baseline.active" ]]; then
      expected=$(stored_baseline_image "$service")
      [[ -n "$expected" && "$image" == "$expected" ]] || die "$service differs from the saved mixed baseline"
    else
      [[ "${image##*:}" == "$current_tag" ]] || die "$service runs $image rather than the recorded SHA; run check first"
    fi
  done
}
if [[ "$operation" == check ]]; then
  [[ "$target" == "$current_tag" ]] || die 'the supplied SHA does not match the current release'
  candidate_file=$current_file
  compose config --quiet || die 'current Compose configuration is invalid'
  for service in "${all_services[@]}"; do
    container=$(compose ps -q "$service")
    [[ -n "$container" && $(docker inspect --format '{{.State.Status}}' "$container") == running ]] || die "$service is not running"
  done
  if [[ ! -f "$state/baseline.active" ]]; then
    mixed=false
    for service in "${services[@]}"; do
      image=$(running_image "$service")
      [[ "${image##*:}" == "$current_tag" ]] || mixed=true
    done
    if [[ "$mixed" == true ]]; then
      [[ ! -e "$state/baseline/images.yaml" ]] || die 'a previous baseline exists; inspect it before recapturing images'
      install -d -m 700 "$state/baseline/deploy"
      cp "$base/compose.vps.yaml" "$state/baseline/compose.vps.yaml"
      cp "$base/deploy/Caddyfile" "$state/baseline/deploy/Caddyfile"
      printf 'RELEASE_TAG=%s\n' "$current_tag" > "$state/baseline/release.env"
      baseline_partial="$state/baseline/images.yaml.partial"
      {
        printf 'services:\n'
        for service in "${services[@]}"; do
          image=$(running_image "$service")
          [[ "$image" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+:[0-9a-f]{40}$ ]] || die "unexpected image reference for $service"
          printf '  %s:\n    image: %s\n' "$service" "$image"
        done
      } > "$baseline_partial"
      chmod 600 "$state/baseline/release.env" "$baseline_partial"
      mv "$baseline_partial" "$state/baseline/images.yaml"
      extra_files=(-f "$state/baseline/images.yaml")
      if ! compose config --quiet; then
        rm -f "$state/baseline/images.yaml"
        die 'saved mixed baseline is not a valid Compose override'
      fi
      extra_files=()
      touch "$state/baseline.active"
      log 'Saved the current mixed-image stack as rollback target baseline'
    fi
  fi
  verify_running_images
  log "Preflight passed for $current_tag with all 12 services running"
  exit 0
fi
if [[ "$operation" == deploy ]]; then
  candidate_file=$current_file
  verify_running_images
fi
snapshot_current() {
  [[ ! -f "$state/baseline.active" ]] || return 0
  local directory="$state/snapshots/$current_tag"
  if [[ ! -d "$directory" ]]; then
    install -d -m 700 "$directory/deploy"
    cp "$base/compose.vps.yaml" "$directory/compose.vps.yaml"
    cp "$base/deploy/Caddyfile" "$directory/deploy/Caddyfile"
  fi
}
install_snapshot() {
  local directory="$state/snapshots/$1"
  if [[ "$1" == baseline ]]; then
    directory="$state/baseline"
  fi
  [[ -f "$directory/compose.vps.yaml" && -f "$directory/deploy/Caddyfile" ]] || die "no configuration snapshot for $1"
  install -m 644 "$directory/compose.vps.yaml" "$base/compose.vps.yaml"
  install -m 644 "$directory/deploy/Caddyfile" "$base/deploy/Caddyfile"
}
restore_before_start() {
  if [[ -f "$state/baseline.active" ]]; then
    install_snapshot baseline
  else
    install_snapshot "$current_tag"
  fi
  if [[ "$operation" == deploy ]]; then
    rm -f "$state/pending.env"
  fi
}

if [[ "$operation" == deploy ]]; then
  [[ ! -e "$state/pending.env" ]] || die 'an earlier release is incomplete; inspect it or roll back first'
  staged="$incoming/$target"
  [[ -d "$staged" && ! -L "$staged" ]] || die 'staged release files are missing'
  for file in compose.vps.yaml deploy/Caddyfile; do
    [[ -f "$staged/$file" && ! -L "$staged/$file" ]] || die "invalid staged file: $file"
  done
  snapshot_current
  install -m 644 "$staged/compose.vps.yaml" "$base/compose.vps.yaml"
  install -m 644 "$staged/deploy/Caddyfile" "$base/deploy/Caddyfile"
else
  snapshot_current
  install_snapshot "$target"
  if [[ "$target" == baseline ]]; then
    [[ -f "$state/baseline/images.yaml" && -f "$state/baseline/release.env" ]] || die 'mixed baseline is incomplete'
    extra_files=(-f "$state/baseline/images.yaml")
  fi
fi

candidate_file="$state/pending.env"
target_tag=$target
if [[ "$target" == baseline ]]; then
  target_tag=$(read_tag "$state/baseline/release.env")
  valid_sha "$target_tag" || die 'mixed baseline has an invalid release tag'
fi
printf 'RELEASE_TAG=%s\n' "$target_tag" > "$candidate_file"
chmod 600 "$candidate_file"

if ! compose config --quiet; then
  restore_before_start
  die 'Compose validation failed; previous configuration restored'
fi
log "Pulling seven application images for $target"
if ! compose pull "${services[@]}"; then
  restore_before_start
  die 'image pull failed; previous configuration restored'
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$backup_dir/educonnect-$timestamp-$current_tag.dump"
partial="$backup.partial"
if [[ -e "$backup" || -e "$partial" ]]; then
  restore_before_start
  die 'backup filename already exists; deployment stopped'
fi
trap 'rm -f "$partial"' EXIT
log "Backing up PostgreSQL to $backup"
if ! compose exec -T postgres sh -c 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$partial"; then
  rm -f "$partial"
  restore_before_start
  die 'database backup failed; deployment stopped'
fi
if [[ ! -s "$partial" ]] || ! compose exec -T postgres pg_restore -l < "$partial" >/dev/null; then
  rm -f "$partial"
  restore_before_start
  die 'database backup could not be verified; deployment stopped'
fi
chmod 600 "$partial"
mv "$partial" "$backup"

previous_id=$current_tag
if [[ -f "$state/baseline.active" ]]; then
  previous_id=baseline
fi
printf '%s\n' "$previous_id" > "$state/previous.id"
chmod 600 "$state/previous.id"

log 'Starting application with AI profile and existing VPS operator configuration'
if ! compose up -d --wait --wait-timeout 600 --remove-orphans; then
  die "startup failed; backup is $backup; use the rollback operation after checking migration compatibility"
fi
if ! compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  die "Caddy reload failed; backup is $backup"
fi
declare -A container_ids restart_counts
for service in "${all_services[@]}"; do
  container=$(compose ps -q "$service")
  [[ -n "$container" && $(docker inspect --format '{{.State.Status}}' "$container") == running ]] || die "$service is not running; backup is $backup"
  container_ids[$service]=$container
  restart_counts[$service]=$(docker inspect --format '{{.RestartCount}}' "$container")
done
sleep 20
for service in "${all_services[@]}"; do
  container=$(compose ps -q "$service")
  [[ "$container" == "${container_ids[$service]}" && $(docker inspect --format '{{.State.Status}}' "$container") == running ]] || die "$service stopped or changed during verification; backup is $backup"
  [[ $(docker inspect --format '{{.RestartCount}}' "$container") == "${restart_counts[$service]}" ]] || die "$service restarted during verification; backup is $backup"
done

domain=$(sed -n 's/^DOMAIN=//p' "$base/.env" | head -n 1 | tr -d '\r')
[[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]] || die 'DOMAIN is missing or invalid in production .env'
healthy=false
for attempt in {1..12}; do
  if curl --fail --silent --show-error --max-time 10 "https://$domain/healthz" >/dev/null \
    && curl --fail --silent --show-error --max-time 15 "https://$domain/api/learning/public/classes?page=0&size=1" >/dev/null; then
    healthy=true
    break
  fi
  sleep 5
done
[[ "$healthy" == true ]] || die "public smoke checks failed; backup is $backup"

mv "$candidate_file" "$current_file"
if [[ "$target" == baseline ]]; then
  touch "$state/baseline.active"
else
  rm -f "$state/baseline.active"
fi
log "Deployment healthy at $target; previous release was $previous_id"
