# EduConnect Blockchain Baseline

## 1. Purpose

Blockchain supports EduConnect contract management by recording/verifying agreement state and handling escrow-related flows.

Target capabilities include:

- contract integrity/recording;
- escrow funding;
- settlement/release;
- refund;
- dispute handling.

Current implementation is PARTIAL: Solidity contract source exists, Foundry tooling exists, Contract Service has Web3j integration, and Web has wallet code, but ABI/address/API gaps remain.

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

This does not imply a complete public REST API. Contract REST Controller evidence was not found during audit.

## 7. Frontend Web3

Current Web source includes:

- MetaMask/window.ethereum wallet handling;
- ethers BrowserProvider usage;
- chain configuration for local Anvil and Sepolia;
- ERC-20 approval/balance style ABI;
- escrow contract interaction wrapper.

However, current frontend escrow ABI does not match the Solidity contract and must be corrected before treating the browser Web3 flow as complete.

## 8. Known Conflicts

### Web3 ABI Mismatch

Solidity uses `bytes32 agreementId` and `bytes32 sessionId` for escrow functions/events.

Current frontend Web3 config uses older `uint256`/`BigInt` agreement and session identifiers, older function names, and event signatures that do not match `IEduConnectEscrow`.

Status: KNOWN_CONFLICT.

### Local Address Mismatch

Current frontend defaults for local Anvil addresses appear reversed compared with existing Anvil deployment evidence:

- deployment artifact: token at `0x5fbdb2315678afecb367f032d93f642f64180aa3`, escrow at `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`;
- frontend default config uses escrow as `0x5FbDB...` and USDC as `0xe7f172...`.

Status: KNOWN_CONFLICT until source/config is aligned.

## 9. Sepolia Deployment Status

Sepolia is target/configured, but deployment evidence found during audit is local/Anvil.

Do not mark Sepolia deployment IMPLEMENTED based only on config or placeholder addresses.

## 10. Blockchain Guardrails

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
