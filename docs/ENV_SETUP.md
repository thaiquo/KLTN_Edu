# Shared environment

## Internal notification deployment order

Contract and Notification must use the same `JWT_SECRET`. The Contract service
signs internal notification requests with a short-lived JWT whose subject is
`contract-service` and scope is `notification-send`. Notification rejects calls
without this token. For a rolling local or production update, start the updated
Contract service first, then start the updated Notification service. The older
Notification service accepts the new authenticated calls during the transition;
reversing the order can temporarily stop contract-related notifications.
Restart Account separately to load its corrected unauthorized response for the
internal recipient lookup. Existing running processes do not pick up these
source changes automatically.

Use one `.env` at the repository root, copied from `.env.example`. PowerShell
startup scripts, backend `run-local.sh`, Docker Compose and Vite read this file.
Vite exposes only keys prefixed `VITE_`; these values are public browser settings.
Never prefix a database password, JWT secret, cloud secret or operator password
with `VITE_`. A browser RPC URL is public and should use a browser-restricted key.

Share `.env.example` with collaborators, who fill their own credentials. The
working `.env` contains access to the operator wallet and other private services.
For the operator wallet signing material:
- In local development: can use either an encrypted keystore file (`BLOCKCHAIN_OPERATOR_KEYSTORE_PATH` + password) or a raw hex private key (`BLOCKCHAIN_OPERATOR_PRIVATE_KEY`).
- In Production VPS (`103.74.100.232`): configured directly as `BLOCKCHAIN_OPERATOR_PRIVATE_KEY=0x...` in `/opt/educonnect/.env`. Keystore overlay is not used.
- Security boundary: Neither the private key nor keystore password is EVER committed to Git or stored in GitHub Actions Secrets.
- Separation of concerns: The deployment SSH key (`VPS_SSH_KEY` / `educonnect-gh-actions`) used by GitHub Actions is an OS-level Linux SSH key, completely separate and distinct from the Ethereum Web3 operator wallet key.

`node scripts/check-operator.cjs` validates the password locally without signing
or sending a transaction. `scripts/start-contract-operator.ps1` starts the
operator from root configuration. `scripts/start-learning.ps1` starts the session
worker. Both services must stay running for continuous settlement; restarting
them catches up eligible work. Do not start duplicate services on the same ports.

`scripts/start-all.ps1` launches Gateway 8080, Account 8081, Learning 8082,
Contract 8083, Notification 8084 and AI skeleton 8085. Run `docker compose up -d`
for PostgreSQL, RabbitMQ and Gotenberg. Contract PDF generation needs Gotenberg.
Account uploads and the current Contract artifact/dispute-evidence runtime need
valid S3 configuration because `STORAGE_PROVIDER=s3` is inherited when
`CONTRACT_STORAGE_PROVIDER` is not explicitly set.

The blockchain operator additionally requires both blockchain flags enabled, the
expected chain/deployment/operator address, a readable encrypted keystore or raw private key,
RPC access and nonzero Sepolia ETH for gas.
Startup validates these prerequisites. Never commit the private key or password file.

Stopping application processes does not delete database state. Learning and
Contract catch up durable overdue work on the next start. Avoid
`docker compose down -v` unless deleting PostgreSQL/RabbitMQ volumes is intended.

Vite is configured with the repository root as its `envDir`, so the frontend and
all backend startup scripts use the same root `.env`. Do not create or distribute
a second `frontend-web/.env`; legacy copies in that location are ignored. Vite
only exposes variables prefixed with `VITE_` to browser code. Keep secrets out of
`VITE_*` and restart Vite after changing the root environment.

For Sepolia RPC stability, use `BLOCKCHAIN_EVENT_BLOCK_BATCH_SIZE=50` as the
logical cursor batch and keep `BLOCKCHAIN_EVENT_LOG_REQUEST_BLOCK_RANGE=10`.
The client splits each logical batch into at most five sequential `eth_getLogs`
requests, each within Alchemy Free's 10-block limit. Near the chain head the
logical range naturally shrinks, so ordinary polling normally uses one request.
Do not raise the per-request range above 10 while using the Free tier.
