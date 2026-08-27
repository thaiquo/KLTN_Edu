#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

mkdir -p abi
forge build
forge inspect src/EduConnectEscrow.sol:EduConnectEscrow abi --json > abi/EduConnectEscrow.json

echo "Exported abi/EduConnectEscrow.json"

