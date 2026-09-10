#!/usr/bin/env bash
set -e


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$SCRIPT_DIR"

if PROJECT_ROOT="$(git -C "$SERVICE_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
  :
else
  PROJECT_ROOT="$(cd "$SERVICE_DIR/../.." && pwd)"
fi

ENV_FILE="$PROJECT_ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  echo "Loading root .env for ai-service..."
  set -a
  # shellcheck disable=SC1090
  if command -v tr >/dev/null 2>&1; then
    source <(tr -d '\r' < "$ENV_FILE")
  else
    source "$ENV_FILE"
  fi
  set +a
fi

echo "Starting ai-service on port ${AI_SERVICE_PORT:-8085}..."
cd "$SERVICE_DIR"

if command -v powershell.exe >/dev/null 2>&1 && [[ -f ./mvnw.cmd ]]; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "./mvnw.cmd spring-boot:run" "$@"
elif [[ -f ./mvnw ]]; then
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
