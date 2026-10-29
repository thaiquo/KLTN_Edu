# Tutor Absence Governance Canary Runbook

This runbook covers `TUTOR_ABSENCE_GOVERNANCE_MODE`. It does not authorize
enabling `ESCROW_TRIAL_ENABLED`.

## Release verdict

- Keep production at `OFF` until the real Learning-to-Contract E2E and the
  Anvil settlement/cancel/refund time-warp scenario have passed.
- Use `SHADOW` before `ENFORCE`.
- Start `ENFORCE` with exactly one dedicated test classroom in the allowlist.
- Do not use an empty allowlist with `ENFORCE`; current application semantics
  treat an empty allowlist as global enforcement.

## Preconditions

1. Confirm the deployed release SHA and successful CI/deploy workflow.
2. Confirm Learning V17 and Contract V22 are successful in Flyway history.
3. Take an off-VPS PostgreSQL backup and record its SHA-256.
4. Confirm `/healthz` and `/api/learning/public/classes` return HTTP 200.
5. Select a dedicated classroom with controlled Tutor/Student/Admin accounts.
6. Ensure the next-session snapshot is real and sufficiently far in the future.
7. Record baseline counts for governance cases, signals, probations and command inbox rows.

## Apply a mode change

Editing the Compose `.env` is not enough, and `docker compose restart` does not
reload changed environment variables. Recreate only Contract Service:

```bash
cd /home/deploy/educonnect-live
docker compose --env-file .env -f compose.vps.yaml up -d --no-deps --force-recreate contract-service
docker compose --env-file .env -f compose.vps.yaml exec -T contract-service \
  sh -lc 'printf "%s\n" "$TUTOR_ABSENCE_GOVERNANCE_MODE" "$TUTOR_ABSENCE_GOVERNANCE_CLASSROOM_IDS"'
```

Do not print the whole container environment because it contains secrets.

## Phase 1: SHADOW

```dotenv
TUTOR_ABSENCE_GOVERNANCE_MODE=SHADOW
TUTOR_ABSENCE_GOVERNANCE_CLASSROOM_IDS=
```

Recreate Contract Service, then verify:

- normal attendance and settlement flows still work;
- candidate logs use the `[SHADOW]` prefix;
- no governance case, HOLD command, probation or termination item is created;
- no future attendance or session is removed;
- no notification claims that a class was held or refunded.

## Phase 2: one-class ENFORCE canary

```dotenv
TUTOR_ABSENCE_GOVERNANCE_MODE=ENFORCE
TUTOR_ABSENCE_GOVERNANCE_CLASSROOM_IDS=<test-classroom-id>
```

Recreate Contract Service. Confirm a non-allowlisted classroom remains SHADOW,
then execute both controlled paths:

1. Three consecutive class-level Tutor absences -> stable HOLD -> Tutor response
   -> Admin continues -> RELEASE -> probation PASS.
2. Three consecutive absences -> expiry or approval -> FREEZE -> settle all open
   sessions -> cancel -> confirmed refund event -> CLOSE.

For each retry, verify the same command/cutoff snapshot is returned and no new
session, duplicate case, duplicate probation or duplicate refund is created.

## Immediate rollback

Set:

```dotenv
TUTOR_ABSENCE_GOVERNANCE_MODE=OFF
TUTOR_ABSENCE_GOVERNANCE_CLASSROOM_IDS=
```

Recreate Contract Service using the command above. `OFF` stops new automatic
decisions. Existing approved cases and in-flight blockchain transactions still
require recovery and reconciliation; do not delete their rows.

Escalate and keep `OFF` if any of these occur:

- Learning/Contract command returns 401, 409 or a snapshot mismatch;
- a case remains pending past its authoritative deadline;
- scheduler lag exceeds one scan interval;
- a settlement exists after the frozen cutoff;
- transaction failure, refund recipient/amount mismatch or duplicate command;
- a non-allowlisted classroom is mutated;
- notification says refund completed before a confirmed chain event.

## Evidence required before broader rollout

- timestamped screenshots for Tutor, Admin and Student views;
- Contract/Learning logs correlated by classroom, source event and command ID;
- before/after database snapshots and Flyway checksums;
- Anvil transaction receipts and accounting invariants;
- production canary start/end time, operator, classroom ID and rollback result.
