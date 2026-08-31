#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Khởi động EduConnect Services ==="

echo "1. Khởi động API Gateway (8080)..."
(cd "$ROOT_DIR/backend/api-gateway" && ./run-local.sh) &

echo "2. Khởi động Account Service (8081)..."
(cd "$ROOT_DIR/backend/account-service" && ./run-local.sh) &

echo "3. Khởi động Learning Service (8082)..."
(cd "$ROOT_DIR/backend/learning-service" && ./run-local.sh) &

echo "4. Khởi động Contract Service (8083)..."
(cd "$ROOT_DIR/backend/contract-service" && ./run-local.sh) &

echo "5. Khởi động Notification Service (8085)..."
(cd "$ROOT_DIR/backend/notification-service" && ./run-local.sh) &

wait
