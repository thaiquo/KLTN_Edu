# EduConnect VPS deployment runbook

This directory contains non-secret deployment configuration. Never commit the
real production `.env`, operator keystore, password file, database dump, SSH key
or GHCR pull token.

## Release inputs

Before the first release, configure these GitHub repository variables:

- `PRODUCTION_ORIGIN`, for example `https://educonnect.example.com`
- `PRODUCTION_REALTIME_ORIGIN`, for example `wss://educonnect.example.com`
- `VITE_ESCROW_CONTRACT_ADDRESS`
- `VITE_USDC_CONTRACT_ADDRESS`
- `VITE_SEPOLIA_RPC_URL`
- `VITE_PROJECT_ID_WALLETCONNECT`

The workflows publish immutable images tagged with the full Git commit SHA.
They do not SSH to or automatically modify the VPS.

## VPS directory

Use a root-owned deployment directory such as `/opt/educonnect`. Copy these
files while preserving their relative paths:

```text
compose.vps.yaml
compose.vps.operator.yaml
deploy/Caddyfile
.env
secrets/operator-keystore.json
secrets/operator-keystore-password
```

Create the VPS `.env` from `deploy/production.env.example`, fill every required
value, and restrict it to the deployment identity. Never copy the repository's
local development `.env` unchanged.

The base Compose file keeps blockchain operator writes disabled. Enable them
only after chain, contract, USDC, cursor, role, gas and keystore checks pass:

```bash
docker compose -f compose.vps.yaml -f compose.vps.operator.yaml config --quiet
docker compose -f compose.vps.yaml -f compose.vps.operator.yaml pull
docker compose -f compose.vps.yaml -f compose.vps.operator.yaml up -d
```

For a core smoke deployment without operator writes:

```bash
docker compose -f compose.vps.yaml config --quiet
docker compose -f compose.vps.yaml pull
docker compose -f compose.vps.yaml up -d
docker compose -f compose.vps.yaml ps
```

To enable AI after resource validation, append `--profile ai` to the base
Compose command. Do not describe AI as operational while that profile is off.

## Release and rollback

Set `RELEASE_TAG` to one exact image SHA tag. Keep the previous known-good tag
before changing it. After a database backup and configuration validation:

```bash
docker compose -f compose.vps.yaml pull
docker compose -f compose.vps.yaml up -d --remove-orphans
docker compose -f compose.vps.yaml ps
```

Rollback application images by restoring the previous `RELEASE_TAG` and running
the same pull/up commands. An older application image does not reverse a Flyway
migration; restore decisions must be made separately from image rollback.

Never use `docker compose down -v` on the shared VPS. It deletes named data
volumes. Do not run `docker image prune` until the new release is healthy and
the rollback image is confirmed available from GHCR.
