# EduConnect Blockchain Baseline

Latest current-deployment decision and runtime hardening (2026-09-12):
[Current escrow hardening](ESCROW_HARDENING_2026-09-12.md). Keep the existing Sepolia master contract.
That report supersedes historical legacy-eligibility and operator-disabled notes below; older observations are retained as history.

## 1. Purpose

Blockchain supports EduConnect contract management by recording/verifying agreement state and handling escrow-related flows.

Target capabilities include:

- contract integrity/recording;
- escrow funding;
- settlement/release;
- refund;
- dispute handling.

Current implementation is PARTIAL: Solidity contract source exists, Foundry tooling exists, Contract Service has Web3j integration, and Web has wallet code. Agreement registration/funding semantics are event-confirmed, but address/deployment/runtime hardening remains incomplete.

## 2. Technology Baseline

- Network: Ethereum-compatible network.
- Target test network: Sepolia.
- Current local evidence: Anvil deployment artifacts.
- Smart Contract: Solidity `0.8.36`.
- Tooling: Foundry.
- Backend integration: Web3j in Contract Service.
- Web integration: ethers.js and MetaMask/window.ethereum.
- Escrow asset: ERC-20/USDC-style test token.
- Gas asset: Sepolia ETH or local native ETH, depending on network.

Important distinction:

- Sepolia ETH is for gas.
- USDC/ERC-20 test token is the escrow asset.

Do not describe Sepolia ETH as the escrow asset.

## 3. Smart Contract Source of Truth

Solidity source is the source of truth for:

- function signatures;
- argument types;
- events;
- roles;
- escrow/dispute/settlement behavior.

Frontend ABI and backend Web3 encoding/decoding must match Solidity before a Web3 flow can be considered complete.

## 4. Smart Contract Responsibilities

Current source centers on `EduConnectEscrow`.

Main responsibilities:

- register an agreement using `bytes32 agreementId` and `bytes32 termsHash`;
- fund an agreement with ERC-20 tokens;
- propose session settlement;
- finalize session settlement after the dispute window;
- open and resolve tutor fraud disputes;
- expire unfunded agreements;
- cancel funded agreements and refund unused amount;
- pause/unpause contract operations.

The contract uses OpenZeppelin access control, pausable behavior, reentrancy protection, and safe ERC-20 transfers.

Escrow funding must call the escrow contract's `fundAgreement(bytes32 agreementId)` function after ERC-20 approval. A raw ERC-20 `transfer(...)` to the escrow address is not a valid agreement-funding operation because it bypasses agreement status checks, exact-amount accounting, and the `AgreementFunded` event.

## 5. Off-chain vs On-chain

Off-chain owns full business data:

- users, roles, profiles;
- class/session/business workflow data;
- full contract/business state;
- transaction metadata and receipt tracking;
- complaint/dispute evidence metadata.

On-chain owns compact verifiable state:

- agreement identifier and terms representation;
- escrow funding state;
- session settlement state;
- dispute/refund/release events and state.

Do not put personal data or full contract text on-chain unless a confirmed design change requires it.

## 6. Backend Integration

Current Contract Service includes Web3j-oriented components for:

- RPC reads;
- calldata encoding for escrow functions;
- operator transaction dispatch;
- transaction receipt watching;
- event log polling;
- event decoding and ingestion;
- blockchain cursor/processed-event persistence;
- workflow updates from blockchain events.

Funding workflow rule: payment submission records a txHash as `PAYMENT_CONFIRMING`; Contract Service marks the agreement `ACTIVE`, locks escrow payment metadata, sends activation notifications, and activates the linked Learning enrollment only after a confirmed `AgreementFunded` event is ingested.

## 7. Frontend Web3

Current Web source includes:

- MetaMask/window.ethereum wallet handling;
- ethers BrowserProvider usage;
- chain configuration for local Anvil and Sepolia;
- ERC-20 approval/balance style ABI;
- escrow contract interaction wrapper.

Browser funding uses escrow `fundAgreement(bytes32 agreementId)` and should surface `PAYMENT_CONFIRMING` until backend event ingestion confirms `AgreementFunded`. The UI must not present tx submission as already-active escrow funding.

## 8. Known Conflicts

### Web3 Interface Verification

Solidity uses `bytes32 agreementId` and `bytes32 sessionId` for escrow functions/events.

Current frontend funding config aligns with `fundAgreement(bytes32)`, but the broader Web3 interface should still be verified against Solidity before treating all settlement/refund/dispute browser flows as complete.

Status: PARTIAL.

### Local Address Mismatch

Current frontend defaults for local Anvil addresses appear reversed compared with existing Anvil deployment evidence:

- deployment artifact: token at `0x5fbdb2315678afecb367f032d93f642f64180aa3`, escrow at `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`;
- frontend default config uses escrow as `0x5FbDB...` and USDC as `0xe7f172...`.

Status: KNOWN_CONFLICT until source/config is aligned.

## 9. Sepolia Deployment Status

Runtime verification on 2026-09-11 confirmed deployed bytecode at
`0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3` on Sepolia. The deployment
transaction sender `0x10dd719B6a13e9d275990d706C2640ab6F1CA28e` currently has both
`OPERATOR_ROLE` and `ARBITRATOR_ROLE` and has Sepolia ETH for gas.

The current database is not reconciled with that deployment. Four agreements
marked `ACTIVE` locally return on-chain agreement status `NONE`. Their historical
payment transactions called a smart-account execution endpoint which performed
raw ERC-20 transfers to the escrow address instead of calling
`fundAgreement(bytes32)`. The escrow address consequently holds 38.4 USDC
(`38,400,000` base units with six decimals) that are not allocated to any agreement.
The deployed V1 contract has no rescue/sweep function, so these historical raw
transfers cannot be settled through the per-agreement functions.

Do not treat a local `ACTIVE`/`LOCKED` row as proof of funding. A usable agreement
must return on-chain status `FUNDED`, and activation must originate from an
ingested, confirmed `AgreementFunded` event emitted by the configured escrow.

The backend operator was enabled locally on 2026-09-11 after successful keystore
decryption and role verification. Startup scheduling is
catch-up based: confirmed proposals whose on-chain dispute deadline elapsed while
the service was offline are queued for finalization after restart.

The replay of five completed classes produced ten per-agreement proposals. Legacy
intents contain the old Anvil platform address as sender and fail before signing.
New agreement initiation now obtains platform wallet, chain, escrow and token
from the validated configured deployment instead of hard-coded values. Existing
signed agreements were not rewritten; they require an explicit replacement terms
and funding process. The current master contract cannot allocate the historical
direct token transfers. No successful per-session Sepolia payout is yet verified.

Later runtime reconciliation on 2026-09-11 verified one correctly registered new
agreement (`Vật lý lớp 9 (2026 -002)`, local id
`6355b191-333a-426b-8f24-a1f06177fd4c`) at on-chain agreement id
`0xd0327b1e4f0ac6b75eefe7b2445e63cb55756985be6a134282d44fb52b6708e9`.
Registration transaction
`0xd70e0051653e2166d1487ef30fb2549117f966fed36351c9a4bf4eefa3510b18`
was successful in Sepolia block `11680831`, and the confirmed
`AgreementRegistered` event moved the local agreement to `WAITING_PAYMENT`.
This particular broadcast was performed by a one-off recovery script, so it is
not production evidence that the automatic registration path completed end to
end. The database transaction audit metadata was subsequently reconciled from
the confirmed public transaction; the processed event remains the authoritative
proof of the state transition.
The on-chain agreement remains `CREATED`, with `remainingAmount=0`; therefore
this proves registration only, not funding or settlement. Its amount is 4.8 USDC
for eight sessions at 0.6 USDC/session, and its on-chain payment deadline is
2026-09-12 08:45:12 UTC (the Solidity payment window is 24 hours, not 48 hours).

Before the funding step, the Web modal was hardened to require the agreement's
exact chain id before allowance, approval, or `fundAgreement`. Payment submission
is also idempotent when the confirmed `AgreementFunded` event reaches the backend
before the browser submits the same transaction hash. Neither change relaxes
wallet ownership, amount, deadline, or confirmed-event checks.

## 10. Blockchain Guardrails

### Unattended session settlement runtime

The operator unlocks its keystore once at service startup; it does not require
human confirmation per session. Set `BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD_FILE`
to an absolute path to a protected UTF-8 secret file (outside the repository), or
supply `BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD` through the process environment.
The environment password takes precedence. A mounted secret file supports server
restarts without an interactive prompt. Never commit either secret.

Required runtime settings: `BLOCKCHAIN_ENABLED=true`,
`BLOCKCHAIN_OPERATOR_ENABLED=true`, operator address, keystore path, and one of
the password sources above. Both Learning and Contract services must be running;
opening the IDE alone starts no scheduler. After deployment the same workers run
continuously while the services remain up. After downtime they catch up.

Before signing each transaction, the operator checks the RPC chain ID and runs
`eth_call` with the intended sender and calldata. A reverting preflight enters
the existing bounded retry/failure pipeline without a broadcast or gas charge.
Preflight cannot guarantee inclusion success if state changes after simulation.
This isolates invalid legacy intents but does not repair unfunded agreements.

The 24-hour deadline starts with the confirmed on-chain proposal, not the class
end time. A previously unproposed old class still needs the full dispute window.
Only confirmed settlement events establish USDC payout/refund success.

### Operational funding boundary and legacy agreements

Contract Service classifies an agreement as operationally funded only when its
`escrow_payment.fund_tx_hash` matches an ingested `processed_event` of type
`AGREEMENT_FUNDED` on the same chain. A local `ACTIVE` value by itself is not
sufficient. Automatic session proposals and direct settlement/cancellation
actions reject active/completed agreements without this evidence.

The Admin/Staff contract view defaults to operational agreements. Legacy rows
remain available under an explicit audit-only filter, are excluded from escrow
and released-value KPIs, and expose no settlement or refund action. Admin may
audit all agreements; Staff is limited by the assigned classroom reviewer.
Neither role may sign on behalf of a Student or Tutor. Manual lifecycle
operations such as explicit `expire` or whole-agreement `cancel/refund unused`
are Admin-only operational actions; Staff handles assigned monitoring,
settlement/dispute review, and dispute resolution scope rather than cancelling
active agreements directly.

Runtime verification on 2026-09-11 found four legacy agreement rows belonging
to the two old classes without a confirmed funding event, and one operational
agreement (`6355b191-333a-426b-8f24-a1f06177fd4c`, `Vật lý lớp 9 (2026 -002)`)
with confirmed `AgreementFunded` evidence. The latter is the only current row
eligible for the automatic per-session settlement pipeline.

- Solidity is the ABI/interface source of truth.
- ETH is not the escrow asset.
- Do not hard-code private keys or wallet secrets.
- Do not call the blockchain flow end-to-end complete while API, ABI, address, or deployment evidence is missing.
- Do not publish PII/full contract content on-chain.
- Do not send blockchain transactions during documentation/audit phases.

## 11. Where to Audit

For blockchain tasks, start with:

- `blockchain/src`;
- `blockchain/script`;
- `blockchain/deployments`;
- `backend/contract-service/src/main/java`;
- `backend/contract-service/src/main/resources`;
- `frontend-web/src/web3`.
