#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$SCRIPT_DIR"

if PROJECT_ROOT="$(git -C "$SERVICE_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  PROJECT_ROOT="$(cd "$SERVICE_DIR/../.." && pwd)"
fi

ENV_FILE="$PROJECT_ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

echo "Starting notification-service..."
cd "$SERVICE_DIR"

if [[ -f ./mvnw ]]; then
  if [[ -x ./mvnw ]]; then
    ./mvnw spring-boot:run "$@"
  else
    sh ./mvnw spring-boot:run "$@"
  fi
elif [[ -f ./mvnw.cmd ]]; then
  ./mvnw.cmd spring-boot:run "$@"
else
  mvn spring-boot:run "$@"
fi
