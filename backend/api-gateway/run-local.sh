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
APPLICATION_PROPERTIES="$SERVICE_DIR/src/main/resources/application.properties"

echo "Loading local environment..."

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Root .env not found."
  echo "Please create it from .env.example and configure local values."
  exit 1
fi

if [[ ! -f "$APPLICATION_PROPERTIES" ]]; then
  echo "application.properties not found at: $APPLICATION_PROPERTIES"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-dev}"

echo "Environment configuration loaded."
echo "Starting api-gateway..."

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
