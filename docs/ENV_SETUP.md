# Shared environment

Use one `.env` at the repository root, copied from `.env.example`. PowerShell
startup scripts, backend `run-local.sh`, Docker Compose and Vite read this file.
Vite exposes only keys prefixed `VITE_`; these values are public browser settings.
Never prefix a database password, JWT secret, cloud secret or operator password
with `VITE_`. A browser RPC URL is public and should use a browser-restricted key.

Share `.env.example` with collaborators, who fill their own credentials. The
working `.env` contains access to the operator wallet and other private services.
The encrypted keystore is a separate local file and is not embedded in `.env`.
Set `BLOCKCHAIN_OPERATOR_KEYSTORE_PATH` for the recipient's machine.

`node scripts/check-operator.cjs` validates the password locally without signing
or sending a transaction. `scripts/start-contract-operator.ps1` starts the
operator from root configuration. `scripts/start-learning.ps1` starts the session
worker. Both services must stay running for continuous settlement; restarting
them catches up eligible work. Do not start duplicate services on the same ports.

The previous `frontend-web/.env` was merged into root `.env` with root values
winning conflicts; originals are preserved in `.local-backups/env-*` locally.
`node scripts/consolidate-env.cjs` is an idempotent migration helper for another
checkout still containing two files. Restart Vite after changing environment.
