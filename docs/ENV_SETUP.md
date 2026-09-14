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

`scripts/start-all.ps1` launches Gateway 8080, Account 8081, Learning 8082,
Contract 8083, Notification 8084 and AI skeleton 8085. Run `docker compose up -d`
for PostgreSQL, RabbitMQ and Gotenberg. Contract PDF generation needs Gotenberg.
Account uploads and the current Contract artifact/dispute-evidence runtime need
valid S3 configuration because `STORAGE_PROVIDER=s3` is inherited when
`CONTRACT_STORAGE_PROVIDER` is not explicitly set.

The blockchain operator additionally requires both blockchain flags enabled, the
expected chain/deployment/operator address, a readable encrypted keystore, a
password environment/file source, RPC access and nonzero Sepolia ETH for gas.
Startup validates these prerequisites. Never commit the password file.

Stopping application processes does not delete database state. Learning and
Contract catch up durable overdue work on the next start. Avoid
`docker compose down -v` unless deleting PostgreSQL/RabbitMQ volumes is intended.

The root `.env` and `frontend-web/.env` are fully synchronized with the master configuration,
and their respective `.env.example` files are sanitized templates without secrets for safe Git tracking.
Developers only need one master `.env` file to deploy across both locations.
Restart Vite after changing environment.
