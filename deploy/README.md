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
After the one-time VPS/GitHub setup, the publish workflow deploys a successful
`main` release automatically. See [AUTO_CD_SETUP.md](AUTO_CD_SETUP.md).

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

The base Compose file defaults blockchain operator writes to disabled. On the
active VPS, the operator is enabled with a raw private key stored only in the
VPS `.env`; the automatic release uses the base file and `--profile ai`.
The keystore overlay below is an alternative for a separately configured VPS:

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

> **Production Status Note (2026-10-23)**: On the active VPS (`103.74.100.232` / `educonnectiuh.duckdns.org`), `--profile ai` has been activated (`qdrant` and `ai-service` are both running), and blockchain operator writes are enabled and verified with Sepolia Escrow V1.

## Release and rollback

The automatic release command keeps the current SHA in `release.env`, overriding
the initial `RELEASE_TAG` in the VPS-only `.env`. Keep the previous known-good
tag before a manual fallback. After a database backup and configuration
validation, use both environment files:

```bash
sudo docker compose --env-file .env --env-file release.env --profile ai -f compose.vps.yaml pull account-service learning-service contract-service notification-service api-gateway frontend-web ai-service
sudo docker compose --env-file .env --env-file release.env --profile ai -f compose.vps.yaml up -d --wait --remove-orphans
sudo docker compose --env-file .env --env-file release.env --profile ai -f compose.vps.yaml ps
```

The first automatic release starts from a mixed image set, recorded by
`educonnect-release check` as `baseline`. Use the release script's rollback
operation to restore that exact set if needed; changing only `RELEASE_TAG`
would not restore it. Later uniform releases can roll back by their saved SHA.
An older application image does not reverse a Flyway migration; restore
decisions must be made separately from image rollback.

Never use `docker compose down -v` on the shared VPS. It deletes named data
volumes. Do not run `docker image prune` until the new release is healthy and
the rollback image is confirmed available from GHCR.

## Shared V1 database checkpoint

The shared VPS keeps the existing Sepolia escrow V1 deployment. The base Compose
stack has blockchain writes disabled; enable the operator only after its chain,
contract address, USDC, roles, key, gas and event cursor are checked together.

Before loading demo data, copy `deploy/database/inspect-vps.sh` to the VPS and
run it as `deploy`. It prints table counts, Flyway history, containers and host
capacity without exposing `.env` secrets. Then copy and run
`deploy/database/backup-vps.sh`. It creates a timestamped PostgreSQL custom
dump under `/home/deploy/educonnect-backups` with restrictive permissions and checks
that `pg_restore` can read its catalogue. Copy the dump off the VPS and rehearse
a full restore to an isolated database before relying on it for recovery.

From an interactive `deploy` SSH session, after copying the scripts to
`/home/deploy`, run the inventory first. The script prompts for your own sudo
password; do not put that password in `.env` or share it in chat:

```bash
bash /home/deploy/inspect-vps.sh
```

Review the counts before running the backup:

```bash
bash /home/deploy/backup-vps.sh
```

For the 2026-10-23 pre-seed snapshot, the backup filename is
`educonnect-20261023T062234Z.dump`. After copying it off the VPS, rehearse a
full restore into an isolated temporary database:

```bash
bash /home/deploy/rehearse-restore-vps.sh \
  /home/deploy/educonnect-backups/educonnect-20261023T062234Z.dump
```

The rehearsal asserts the inspected table/Flyway counts and removes only the
temporary database it created. It never drops or modifies `kltn_db`.

The three `db/dev-data` scripts are separate from Flyway. They create privileged
users, Student/Tutor users and Learning demo rows; none inserts contract or
escrow rows directly. The Learning script includes completed historical
sessions, which the settlement delivery worker may inspect. It also changes
existing demo users, schedules and sessions when rerun. Review and adapt its
passwords and rerun behavior before loading it into a shared public database.

For the inspected, backed-up 2026-10-23 database only, `seed-vps.sh` builds a
one-time seed from those three sources. It remaps synthetic Student/Tutor email
addresses to `@demo.educonnect.invalid`, excludes the old completed sessions,
attendance and reviews, and replaces all seeded password hashes with unique
random BCrypt credentials before committing. It aborts if users/classes or
financial rows already exist. Keep the VPS on the `prod` profile.

Copy the three source SQL files to `/home/deploy/educonnect-seed-source/` and
the script to `/home/deploy/seed-vps.sh`. From an interactive `deploy` SSH
terminal, first test against a restored isolated database:

```bash
bash /home/deploy/seed-vps.sh rehearse
```

Only after that passes, apply once to `kltn_db`:

```bash
bash /home/deploy/seed-vps.sh apply
```

The apply command asks for `APPLY` and writes the one-time login credentials to
a mode-600 file under `/home/deploy/educonnect-backups/`. Copy it off-VPS and
keep it out of Git and chat. Neither mode changes Docker images or the Sepolia
contract.
