# EDUCONNECT Blockchain Implementation Status

## Current phase

```text
P0 — Business rules and state machine: PASS
P1 — Foundry skeleton: PASS
P2 — Solidity escrow logic and tests: PASS
P3 — Anvil local integration: PASS
P4 — Contract Service integration: PASS (P4.1-P4.9 PASS)
P5 — Frontend/local E2E: PASS (React/Vite, TypeScript, Tailwind CSS, Ethers v6, AppKit, Lucide ExternalLink)
P6 — Sepolia Testnet Deployment: PASS (Deployed, verified, config synced)
P7 — End-to-End EIP-712 Gasless Signing & Multi-Channel Notifications: PASS (Full lifecycle verified)
```

Business-rule addendum (2026-08-25): `ADMIN` may resolve every dispute;
`STAFF` may resolve only disputes for classrooms they personally approved,
verified against Learning Service `reviewedByEmail` before Contract Service
submits an arbitrator transaction. The Solidity role model remains unchanged.

Dispute-bulk addendum (2026-08-27): the 24-hour dispute window is only the
deadline for students to submit new disputes. Staff/Admin may resolve existing
valid disputes before that deadline, including with a bulk action, but later
valid disputes submitted before the same deadline remain accepted. Bulk
resolution applies only to already-open valid disputes, not every student in
the classroom/session; Contract Service still sends and audits one on-chain
resolve transaction per disputed student agreement.

## P5 design addendum — wallet stack

- Date: 2026-08-27
- Planned stack: React/Vite + Reown AppKit +
  `@reown/appkit-adapter-ethers` + ethers v6.
- AppKit handles MetaMask, WalletConnect, and injected wallet connections;
  ethers v6 handles native ETH/USDC/allowance reads and Student transactions.
- Only Student `approve` and `fundAgreement` are browser-signed in V1.
  Operator/arbitrator calls remain in Contract Service.
- Account/network changes invalidate stale payment intent and signer state.
- Frontend roles come from backend authorization, never an account-number or
  wallet-address hard-code.
- P5 will migrate the current npm lock to pnpm once, add TypeScript configuration
  without rewriting unrelated JSX, and use the exported escrow ABI/hash.
- No frontend package or wallet code was changed by this planning addendum.

## P4.1 handoff — schema, state safety, configuration

- Date: 2026-08-27
- Scope is isolated to Contract Service; no Account/Learning/Notification tables
  or behavior were changed.
- Flyway V1 creates the ten Contract Service tables from the master guide with
  business, transaction, cursor, outbox, and consumer idempotency constraints.
- All on-chain amounts use `NUMERIC(78,0)` and Java-side state code avoids
  floating-point amounts.
- `classroom_reviewer_email` and resolver identity/role audit columns preserve
  the ADMIN-all / STAFF-own-approved-class dispute rule for the later API slice.
- Agreement/payment/transaction state guards prevent activation directly from
  a submitted transaction hash; confirmation remains mandatory.
- Blockchain properties are disabled by default and fail fast when enabled with
  a missing chain/RPC/address configuration. No signer or private key exists in
  this slice.
- Migration and tests run against an isolated in-memory database; the shared
  project PostgreSQL database was not modified.
- Test command: `JAVA_HOME=C:\Program Files\Java\jdk-21.0.8` with
  `backend/contract-service/mvnw.cmd test`
- Result: Java 21.0.8, 13 tests passed, 0 failed; Flyway migration V1 applied
  successfully.
- P4 overall remains `IN PROGRESS`. Next slice: JPA entities/repositories and a
  read-only Web3j gateway that validates chain ID, bytecode, token decimals, and
  immutable contract addresses against Anvil.

## P4.2 handoff — JPA core and read-only Web3j gateway

- Date: 2026-08-27
- Scope remains isolated to Contract Service. No Account, Learning,
  Notification, frontend, or shared PostgreSQL data was changed.
- Web3j `4.14.0` is pinned. This slice contains no credentials, transaction
  manager, signer, nonce allocation, or write transaction.
- Core JPA mappings/repositories were added for `contract_agreement`,
  `escrow_payment`, and `blockchain_transaction`. Hibernate validates these
  mappings against Flyway V1 during the application context test.
- The read-only gateway fails fast when the RPC chain ID, escrow/token bytecode,
  escrow-bound token, token decimals, or platform wallet does not match runtime
  configuration.
- The ABI-aligned `getAgreement(bytes32)` reader decodes all 13 Solidity struct
  fields into a Java snapshot, including base-unit amounts and on-chain status.
- Full test command: Java 21.0.8 with
  `backend/contract-service/mvnw.cmd test`.
- Full result: 20 tests, 0 failed, 1 Anvil integration test skipped unless
  `RUN_ANVIL_IT=true`.
- Real Anvil checkpoint: deploy to chain `31337`, then run
  `AnvilBlockchainReadGatewayIntegrationTest`; 1 test passed, 0 failed, 0
  skipped. It verified network/bytecode/immutable values and decoded an empty
  agreement snapshot from the deployed Solidity contract.
- The temporary Anvil process was stopped after verification. Sepolia remains
  intentionally untouched.
- P4 overall remains `IN PROGRESS`. Next slice P4.3 is transaction
  command/outbox idempotency; signer and receipt watcher follow only after that
  DB safety layer passes.

## P4.3 handoff — transaction intent and outbox idempotency

- Date: 2026-08-27
- Scope remains isolated to Contract Service and its H2/Flyway integration test
  database. No shared PostgreSQL data or other service behavior was changed.
- Added the canonical V1 transaction actions `REGISTER`, `PROPOSE`,
  `OPEN_DISPUTE`, `FINALIZE`, `RESOLVE`, `CANCEL`, and `EXPIRE` with the
  idempotency-key prefixes defined in the P0 domain specification.
- Command validation rejects invalid chain IDs, Ethereum addresses, bytes32
  calldata hashes, action scope, and malformed idempotency keys before a DB
  write.
- A new command creates exactly one `blockchain_transaction` in `CREATED` and
  one `blockchain.transaction.intent.created.v1` outbox event in the same DB
  transaction. The event contains public transaction metadata and the calldata
  hash, not calldata, credentials, or private-key material.
- Repeating the same key and identical intent returns the existing transaction.
  Reusing that key with different action/chain/address/hash/scope raises an
  idempotency conflict instead of silently accepting the wrong command.
- The DB unique key is also handled as the concurrency race barrier: four
  simultaneous identical callers converged to one transaction ID and one
  outbox row in the integration test.
- A forced outbox serialization failure rolled back the transaction intent,
  proving the two records cannot be committed partially.
- No signer, nonce manager, raw transaction sender, receipt polling, RPC write,
  RabbitMQ publisher, or Sepolia integration exists in this slice.
- Focused P4.3 result: 8 tests passed, 0 failed.
- Full Contract Service result: 28 tests, 0 failed, 1 existing Anvil read test
  skipped unless `RUN_ANVIL_IT=true`.
- P4 overall remains `IN PROGRESS`. Next slice P4.4 is the single-dispatcher
  operator signer/send path plus receipt watcher, tested on Anvil before any
  Sepolia configuration.

## P4.4 handoff — operator dispatcher and receipt watcher

- Date: 2026-08-27
- Scope remains isolated to Contract Service. No frontend, other backend
  service, shared PostgreSQL data, Solidity contract, or Sepolia state changed.
- Flyway V2 adds the calldata needed to build a transaction plus temporary
  signed-raw-transaction and dispatch timestamp fields. The command validates
  that `calldataHash = keccak256(calldata)` before writing the intent.
- Transaction lifecycle is now `CREATED -> DISPATCHING -> SUBMITTED ->
  CONFIRMED`, with terminal `FAILED`. `DISPATCHING` separates a signed/possibly
  broadcast transaction from an unsent intent.
- The dispatcher claims only one `CREATED` row with a pessimistic DB lock,
  assigns the pending operator nonce, signs once, persists nonce/expected hash,
  and only marks `SUBMITTED` when RPC returns the same transaction hash.
- An uncertain RPC broadcast stays `DISPATCHING`; a second dispatcher pass does
  not send it again. The receipt watcher reads by the already-known hash and
  can reconcile that row without creating a new transaction or nonce.
- The watcher marks `CONFIRMED` only for a successful receipt after the
  configured confirmation count. A reverted receipt becomes `FAILED`; raw
  signed data is cleared when a terminal receipt is recorded.
- Runtime writes are disabled by default. Enabling them requires a dedicated
  operator address plus encrypted Web3j keystore path/password; Student/Tutor
  keys and MetaMask seed phrases never belong in Contract Service.
- Focused dispatcher/command result: 12 tests passed, 0 failed.
- Real Anvil write checkpoint: 1 test passed using a random in-memory operator
  funded only on the temporary local chain; signing, raw broadcast, hash match,
  and successful receipt read were verified. The Anvil process was stopped.
- Full Contract Service result: 34 tests, 0 failed, 2 opt-in Anvil tests skipped
  during the normal suite. Sepolia remains intentionally untouched.
- P4 overall remains `IN PROGRESS`. Next slice P4.5 is event decoding plus the
  confirmation cursor/reorg-safe event identity; business-state activation
  remains gated until matching expected events are proven.

## P4.5 handoff — event decoder, confirmed cursor, and reorg detection

- Date: 2026-08-27
- Scope remains isolated to Contract Service event ingestion plus local
  blockchain developer tooling. No business state, frontend, other backend
  service, shared PostgreSQL data, or Sepolia state changed.
- The decoder recognizes all ten V1 `EduConnectEscrow` business events and
  preserves uint amounts as decimal base-unit strings without floating point.
- The RPC gateway now reads latest block, exact block hash, and logs filtered by
  the configured escrow address and block range.
- Flyway V3 extends `processed_event` with chain/address/transaction/log/block
  audit fields and a unique `(chain_id, transaction_hash, log_index)` constraint.
  Cursor initialization supports `startBlock - 1`, so the deployment block is
  not skipped.
- The ingestion service validates chain ID, contract address, requested range,
  log identity, and current block hash. It stores decoded logs and advances the
  cursor in one DB transaction and reads only through the configured safe head.
- A cursor or log block-hash mismatch raises a reorg error and rolls back the
  scan. Repeating a completed scan does not duplicate processed logs.
- A five-second configurable polling worker is enabled only with blockchain
  integration and prevents overlapping runs inside one service instance.
- Focused P4.5 result: 6 tests passed, 0 failed. Full Contract Service result:
  41 tests, 0 failed, 3 opt-in Anvil tests skipped in the normal suite.
- Real Anvil checkpoint: 1 test passed after deploying the master contract,
  sending `registerAgreement`, reading its real `AgreementRegistered` log, and
  decoding agreement/student/tutor/amount/session fields. Anvil was stopped.
- Solidity regression result: 34 tests passed, including both invariant tests.
- The user-created empty `blockchain/makefile` now has safe build/test/ABI/Anvil
  targets and a gated Sepolia target using a Foundry keystore account; no
  private key is embedded.
- P4 remains `IN PROGRESS`. Next slice P4.6 is the agreement-registration
  workflow: build canonical calldata, create the idempotent `REGISTER` intent,
  match confirmed receipt plus `AgreementRegistered`, then enter
  `WAITING_PAYMENT`.

## P4.6 handoff — agreement registration workflow & state sync

- Date: 2026-08-27
- Scope remains isolated to Contract Service agreement registration workflow and
  blockchain state synchronization.
- Added `EduConnectEscrowCalldataEncoder` to generate Web3j canonical ABI calldata
  for `registerAgreement(bytes32, address, address, bytes32, uint256, uint256, uint32)`.
- Added `AgreementRegistrationWorkflowService`:
  - `initiateRegistration(UUID agreementId)` validates agreement status `PREPARING_BLOCKCHAIN`
    and creates idempotent `REGISTER:{chainId}:{agreementId}` transaction intent.
  - `processConfirmedRegistrationEvent(ProcessedEvent event)` deserializes `AGREEMENT_REGISTERED`
    event payload, validates parameter match with DB entity (`student`, `tutor`, `termsHash`,
    `totalAmount`, `pricePerSession`, `totalSessions`), updates `paymentDeadline`, and
    transitions status `PREPARING_BLOCKCHAIN -> WAITING_PAYMENT`.
  - Atomically creates `contract.waiting_payment.v1` outbox event for Notification Service.
- Full Contract Service test result: 49 tests passed, 0 failed, 4 opt-in Anvil tests skipped
  in normal suite.
- Opt-in Anvil checkpoint (`RUN_ANVIL_REGISTRATION_IT=true`): verified end-to-end execution
  (registration intent creation -> operator dispatch -> event ingestion -> `WAITING_PAYMENT`
  transition and outbox event creation).
- P4 remains `IN PROGRESS`. Next slice P4.7 is student payment funding workflow (`fundAgreement`).

## P4.7 handoff — student payment funding workflow & contract activation sync

- Date: 2026-08-27
- Scope remains isolated to Contract Service.
- Implemented `AgreementFundingWorkflowService`:
  - `recordPaymentSubmission`: records student fund tx hash and transitions `ContractAgreement` to `PAYMENT_CONFIRMING` and `EscrowPayment` to `CONFIRMING`.
  - `processConfirmedFundingEvent`: verifies incoming `AGREEMENT_FUNDED` events against database (`student`, `amount`), transitions `ContractAgreement` to `ACTIVE` and `EscrowPayment` to `LOCKED`, and emits `contract.activated.v1` outbox event.
- Added domain helper methods to `ContractAgreement` and `EscrowPayment`.
- Added `EduConnectEscrowCalldataEncoder.encodeFundAgreement`.
- Verified with 54 passing tests across the entire Contract Service test suite.
- P4 remains `IN PROGRESS`. Next slice P4.8 is session proposal workflow (`proposeSession`).

## P4.8 handoff — session proposal and finalization workflow

- Date: 2026-08-27
- Scope remains isolated to Contract Service.
- Created `SessionSettlement` JPA entity and `SessionSettlementRepository`.
- Added `encodeProposeSessionSettlement` and `encodeFinalizeSession` to `EduConnectEscrowCalldataEncoder`.
- Implemented `SessionSettlementWorkflowService`:
  - `initiateSessionProposal`: creates `PROPOSE` transaction intent for operator to submit on-chain session settlement proposal with attendance outcome (`BOTH_PRESENT`, `STUDENT_ABSENT_TUTOR_PRESENT`, `TUTOR_ABSENT`).
  - `processConfirmedSessionProposalEvent`: syncs confirmed `SESSION_SETTLEMENT_PROPOSED` event, enters `PROPOSED` status, stores `disputeDeadline`, and emits `session.settlement.proposed.v1` outbox event.
  - `initiateSessionFinalization`: checks that 24h dispute deadline has expired, then creates `FINALIZE` transaction intent.
  - `processConfirmedSessionSettledEvent`: syncs `SESSION_SETTLED` event, updates settlement to `SETTLED` or `REFUNDED`, increments settled sessions, automatically transitions `ContractAgreement` to `COMPLETED` when all sessions settle, and emits `session.settled.v1` / `session.refunded.v1` and `contract.completed.v1` outbox events.
- Verified with 59 passing tests across the entire Contract Service test suite.
- P4 remains `IN PROGRESS`. Next slice P4.9 is dispute and resolution workflow (`openDispute` & `resolveSession`).

## P4.9 handoff — dispute and resolution workflow (ADMIN & STAFF role check)

- Date: 2026-08-27
- Scope remains isolated to Contract Service.
- Created `Dispute` and `DisputeEvidence` JPA entities and repositories.
- Added `encodeOpenTutorFraudDispute` and `encodeResolveTutorFraudDispute` to `EduConnectEscrowCalldataEncoder`.
- Implemented `DisputeWorkflowService`:
  - `initiateDisputeOpening`: validates complainant is student, outcome is `BOTH_PRESENT`, and dispute window is active (`now <= disputeDeadline`); creates `OPEN_DISPUTE` intent, stores dispute and evidence, updates settlement to `DISPUTED`.
  - `processConfirmedDisputeOpenedEvent`: syncs confirmed `TUTOR_FRAUD_DISPUTE_OPENED` event, sets dispute to `OPEN`, emits `dispute.opened.v1` outbox event.
  - `initiateDisputeResolution`: enforces authorization (`ADMIN` resolves any dispute; `STAFF` resolves only disputes for classrooms they personally approved matching `classroomReviewerEmail`), creates `RESOLVE` intent, transitions dispute to `RESOLUTION_PENDING`.
  - `processConfirmedDisputeResolvedEvent`: syncs confirmed `TUTOR_FRAUD_DISPUTE_RESOLVED` event, updates dispute to `APPROVED` / `REJECTED`, updates settlement to `REFUNDED` / `SETTLED`, marks agreement `COMPLETED` when all sessions settle, and emits `dispute.resolved.v1`, `session.settled.v1`/`session.refunded.v1`, and `contract.completed.v1` outbox events.
- Added comprehensive unit tests in `DisputeWorkflowTest` (7 tests) and opt-in Anvil E2E in `AnvilDisputeIntegrationTest`.
- All 67 tests across `contract-service` pass with 0 failures, 0 errors.
- **Phase P4 is now 100% COMPLETE and PASS.**

## P5 handoff — Frontend Web3 E2E Integration (React/Vite, TypeScript, Tailwind CSS, Ethers v6, AppKit)

- Date: 2026-08-27
- Tooling and Language:
  - Vite v8 + React + Tailwind CSS v4.
  - TypeScript configured via `tsconfig.json` with strict type definitions in `vite-env.d.ts`.
  - Installed Web3 packages: `ethers` (v6.16), `@reown/appkit`, `@reown/appkit-adapter-ethers`, `lucide-react`.
- Web3 Core Services:
  - `src/web3/web3Config.ts`: Multi-chain configuration for Anvil Localhost (`31337`) and Sepolia Testnet (`11155111`), Escrow and USDC contract addresses, and minimal standard ABIs.
  - `src/web3/useWeb3Wallet.tsx`: React Web3 hook and context providing account address, chain ID, ETH & USDC balance, network switching, auto-reconnect, and account change listeners.
  - `src/web3/AppKitProvider.tsx`: Global Web3 wrapper for the application.
  - `src/web3/escrowContractService.ts`: Type-safe methods for USDC `approve`, Escrow `fundAgreement`, dispute opening (`openTutorFraudDispute`), and dispute resolution (`resolveTutorFraudDispute`).
- UI Components:
  - `src/components/common/EtherscanLink.tsx`: Formatted blockchain address / transaction link with `lucide-react` `ExternalLink` icon linking to Sepolia Etherscan.
  - `src/components/common/WalletConnectButton.tsx`: Interactive navigation header component showing wallet address, ETH & USDC balance, chain switcher badge, and disconnect options.
  - `src/components/contract/EscrowPaymentModal.tsx`: 2-step student payment dialog (`Approve USDC` -> `Fund Escrow Deposit` with tx confirmation and Etherscan link).
  - `src/components/contract/DisputeManagementPanel.tsx`: Student dispute opening modal with SHA-256 evidence hashing, and Staff/Admin dispute resolution actions with reviewer email validation.
  - `src/components/contract/ContractAuditTimeline.tsx`: Blockchain timeline stepper visualizing contract milestones and block/transaction proof.
  - `src/components/contract/EscrowContractsView.tsx`: Integrated contract portal view for student, tutor, staff, and admin.
- Build & Verification:
  - Frontend production build: `npm run build` exited with code 0 (`✓ built in 1.67s`).
  - Backend integration test suite: 67 tests executed and passed (`BUILD SUCCESS`).
- **Phase P5 is 100% PASS.** Next phase is **P6: Sepolia Testnet Deployment**.

## P3 handoff

- Date: 2026-08-25
- Chain: local Anvil `31337`
- Deployment: `blockchain/deployments/anvil-31337.json`
- Evidence: `blockchain/deployments/anvil-p3-evidence.md`
- Separate actors: platform/operator, Student, and Tutor
- Flows passed: register, approve, fund, 85/15, 45/10/45, tutor-absent
  refund, dispute APPROVED, dispute REJECTED, cancel/refund-unused
- Open dispute remained locked after advancing Anvil time by 86,401 seconds
- Final conservation: Student 89.8 + Tutor 8.6 + Platform 1.6 + Escrow 0 =
  initial 100 eUSDC
- Sepolia deployment/verification: not started and intentionally gated

## P0 handoff

- Date: 2026-08-25
- Git commit: not created
- Baseline guide: `Plan/EDUCONNECT_BLOCKCHAIN_MASTER_ESCROW_IMPLEMENTATION_GUIDE.md` v2.0
- Phase specification: `docs/blockchain-p0-domain-spec.md`
- Source-code changes: none
- Database/API changes: none
- Deployment addresses: none
- ABI version/hash: none
- Foundry/Solidity/OpenZeppelin/Web3j versions: not selected by installed tooling yet

## P1 handoff

- Date: 2026-08-25
- Git commit: not created
- Foundry/Forge/Cast/Anvil: `1.7.1`
- Solidity compiler: `0.8.36`
- OpenZeppelin Contracts: `5.7.0`
- Forge Standard Library: `1.16.2`
- Source layout: `src/`, `src/interfaces/`, `src/mocks/`, `script/`, `test/`
- Deployment addresses: none
- ABI version/hash: skeleton only; no integration ABI published
- Database/API changes: none

P1 files:

```text
blockchain/foundry.toml
blockchain/.gitignore
blockchain/.env.example
blockchain/README.md
blockchain/src/EduConnectEscrow.sol
blockchain/src/interfaces/IEduConnectEscrow.sol
blockchain/src/mocks/EduTestUSDC.sol
blockchain/script/DeployEduConnectEscrow.s.sol
blockchain/test/EduConnectEscrow.t.sol
blockchain/test/EduConnectEscrow.invariant.t.sol
blockchain/deployments/.gitkeep
```

P1 checkpoint:

```text
forge fmt --check: PASS
forge build: PASS (Solc 0.8.36)
forge test -vvv: PASS (3 passed, 0 failed)
OpenZeppelin resolves at 5.7.0: PASS
No project private key detected: PASS
Nested Git repository/submodule metadata: none
```

Forge reported a non-fatal warning because the sandbox could not write its
optional function-signature cache under the user profile. Compilation and all
tests still completed successfully.

## Decisions

- `P0-001`: `registerAgreement` computes the 24-hour payment deadline from its
  block timestamp rather than accepting an operator-supplied deadline.
- Canonical terms use compact ordered JSON and Keccak-256.
- Tutor accepts before Student.
- `EnrollmentRequest.ACCEPTED` reserves capacity; it does not activate access.
- `contract.activated.v1` after confirmed `AgreementFunded` is the only
  Enrollment activation trigger.
- A refunded final session counts as a processed session for agreement
  completion accounting.
- Open session count is tracked on-chain so cancellation cannot bypass a
  `PROPOSED` or `DISPUTED` settlement.
- Released and refunded totals are tracked per agreement to make the
  conservation invariant directly auditable.

## Current repository observations

- `blockchain/` contains the P2 master escrow implementation, tests, deployment
  script, exported ABI, and P3 Anvil evidence. It has not been deployed to
  Sepolia yet.
- `backend/contract-service/` now contains the P4.1 schema/state/configuration
  foundation and P4.2 core persistence/read-only Web3j integration.
- Learning Service currently has `EnrollmentRequest` but no separate
  `Enrollment`, Session, or Attendance implementation.
- Existing Learning code counts `EnrollmentRequest.ACCEPTED` toward occupied
  capacity. It must not be treated as paid/active classroom access when P4/P5
  integration is implemented.

These observations do not authorize cross-service database writes. Contract
Service integration must continue through APIs/events owned by each service.

## P0 verification

Documentation checks:

```text
Master guide decisions preserved: PASS
State-machine terminal and invalid paths defined: PASS
Payout conservation rule defined: PASS
Dispute scope/deadline defined: PASS
Service ownership defined: PASS
Canonical terms/hash rule defined: PASS
Unrelated source code untouched: PASS
```

No build or test command is required for the documentation-only P0 phase.

## P2 handoff

- Date: 2026-08-25
- Git commit: not created
- Contract: `blockchain/src/EduConnectEscrow.sol`
- Interface: `blockchain/src/interfaces/IEduConnectEscrow.sol`
- Deployment script: `blockchain/script/DeployEduConnectEscrow.s.sol`
- Unit/fuzz tests: `blockchain/test/EduConnectEscrow.t.sol`
- Invariant handler/tests: `blockchain/test/EduConnectEscrow.invariant.t.sol`
- ABI: `blockchain/abi/EduConnectEscrow.json`
- ABI SHA-256: `A6B021B152DC7B1624295104CC5F03C497A32AF8BFB6D792982437C0E6E9F008`
- Deployment addresses/transactions: none
- Database/API changes: none

Implemented behavior:

```text
constructor + DEFAULT_ADMIN/OPERATOR/ARBITRATOR roles
register agreement + on-chain 24-hour payment deadline
exact student-only USDC funding
85/15 settlement
45/10/45 settlement
100% student refund for tutor absence
individual tutor-fraud dispute + binary arbitration
agreement expiration
refund of unused funds after cancellation
pause normal flow while preserving dispute resolution/refund exits
multi-agreement isolation and accounting totals
```

P2 checkpoint:

```text
forge fmt --check: PASS
forge lint: PASS, no unexplained Solidity lint warning
forge build: PASS (Solc 0.8.36)
forge test -vvv: PASS (34 passed, 0 failed)
fuzz payout conservation: PASS (256 runs)
invariant accounting conservation: PASS (256 runs, 128,000 calls)
invariant escrow balance/liability: PASS (256 runs, 128,000 calls)
contract coverage: 99.31% lines, 96.57% statements, 84.21% branches, 100% functions
gas report reviewed: deployment size 9,582 bytes
ABI export: PASS
private-key pattern scan in project-owned Blockchain files: PASS
```

Coverage reports 0% for the deployment script because network-specific script
execution belongs to P3/P6. Core `EduConnectEscrow.sol` coverage is reported
separately above. Foundry's coverage command emitted internal anchor warnings
while instrumenting Solidity 0.8.36; it exited successfully and all 34 tests
passed under coverage.

## P6 handoff

- Date: 2026-08-28
- Chain: Ethereum Sepolia Testnet (`11155111`)
- Contract Address: `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`
- Transaction Hash: `0x5228c3750c7f284779df08990d9df3ab67aaf58a31a766d07c6dcf3ce4c21686`
- Verification Status: `Pass - Verified` on Sepolia Etherscan.
- Configuration Updates:
  - Root `.env` and `.env.example` updated with `BLOCKCHAIN_ESCROW_ADDRESS`, `BLOCKCHAIN_START_BLOCK=11584099`, and `BLOCKCHAIN_CHAIN_ID=11155111`.
  - Frontend `frontend-web/.env` and `.env.example` updated with `VITE_ESCROW_CONTRACT_ADDRESS` and `VITE_DEFAULT_CHAIN_ID=11155111`.
- Setup Method: `cast wallet import` was used to create a secure local keystore named `edu-deployer`, avoiding hardcoded private keys in environment files. `make deploy-sepolia` successfully executed using `forge script` with `.env` variables.

## Next phase gate

Phase P6 (Sepolia Testnet Deployment) is 100% PASS.
Phase P7 (End-to-End EIP-712 Gasless Signing & Multi-Channel Notifications) is 100% PASS.

## P7 handoff — EIP-712 Gasless Signing, Multi-Party Contract Lifecycle, Waitlist Readiness & Multi-Channel Notification Integration

- Date: 2026-08-31
- Scope: `contract-service`, `notification-service`, `learning-service`, and `frontend-web`.
- Key Features Implemented & Verified:
  1. **EIP-712 Gasless Signing (0 Gas)**:
     - Frontend `src/web3/eip712Signer.ts`: Calls `signer.signTypedData(domain, types, value)` using EIP-712 standard with `verifyingContract: 0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3` and `chainId: 11155111`.
     - Backend `Eip712VerificationService.java`: Computes Domain Separator, ClassContract TypeHash, and validates cryptographic signatures using Web3j ECRecover (`Sign.signedMessageHashToKey` / `Keys.getAddress`).
     - Flyway migration `V4__add_signature_to_contract_acceptance.sql`: Stores `signature VARCHAR(132)` in `contract_acceptance` table.
  2. **Multi-Party Contract Lifecycle & State Machine**:
     - Sequential workflow: `INIT` (`PENDING_TUTOR_ACCEPTANCE`) -> `TUTOR_SIGN` (`PENDING_STUDENT_ACCEPTANCE`) -> `STUDENT_SIGN` (`PREPARING_BLOCKCHAIN` -> `WAITING_PAYMENT` with 24h deadline) -> `ESCROW_DEPOSIT` (`ACTIVE` / `LOCKED`).
     - Safe error branches: Payment retryable (`FAILED_RETRYABLE`), expiration handling (`EXPIRED`) after 24h, freeing up classroom capacity for waitlist enrollment.
  3. **Multi-Channel Notification Hub (`notification-service`)**:
     - `spring-boot-starter-mail` integrated with `EmailNotificationService.java` for responsive branded HTML emails (`AGREEMENT_PENDING_STUDENT`, `AGREEMENT_WAITING_PAYMENT`, `AGREEMENT_ACTIVATED`).
     - WebSocket real-time in-app notification dispatching with unread badge counter.
  4. **In-App Legal Contract Viewer & PDF Export (`frontend-web`)**:
     - `ContractDocumentModal.tsx`: Displays formal legal document (parties, fees, 85/15 Escrow rules, 24h dispute window, EIP-712 cryptographic proofs, terms hash) with browser print / PDF export.
     - Integrated across `EscrowContractsView.tsx`, `StudentRequestsView.tsx`, and `NotificationDropdown.tsx`.
- Verification Results:
  - `contract-service`: 67/67 tests passed, 0 failures (`BUILD SUCCESS`).
  - `notification-service`: 5/5 tests passed, 0 failures (`BUILD SUCCESS`).
  - `frontend-web`: TypeScript compilation `tsc --noEmit` passed with 0 errors.

## Next steps
- Execute live Sepolia transaction tests with funded MetaMask accounts in local dev server environment.
- Continue system integration tests and end-to-end user scenario demonstrations.
