# EDUCONNECT Blockchain V1 — P0 Domain Specification

> Status: `APPROVED_BASELINE`
> Scope: Phase P0 only. This document defines the business contract for later
> Solidity, backend, frontend, database, and integration work. It does not mean
> those parts have been implemented.
> Authoritative source: `Plan/EDUCONNECT_BLOCKCHAIN_MASTER_ESCROW_IMPLEMENTATION_GUIDE.md`.

## 1. Scope and non-goals

EDUCONNECT V1 deploys one `EduConnectEscrow` master smart contract. Every
student/classroom contract is represented by one independent on-chain
`agreementId`. The escrow contract holds test USDC and distributes one fixed
session amount at a time.

V1 does not include mainnet, real money, Chainlink, upgradeable proxies,
EIP-712 contract signatures, arbitrary payout percentages, DAO/multisig, or
automatic Google Meet/Zoom duration verification.

Blockchain does not replace PostgreSQL:

- PostgreSQL is the source of truth for users, classrooms, enrollment,
  attendance, full terms, acceptance audit, disputes, and evidence metadata.
- `EduConnectEscrow` is the source of truth for escrowed USDC, on-chain
  agreement/session state, and final on-chain payout/refund events.

## 2. Stable identifiers

The Contract Service owns UUIDs and their deterministic on-chain identifiers:

```text
agreementId = keccak256(UTF-8("EDUCONNECT:AGREEMENT:" + lowercaseAgreementUuid))
sessionId   = keccak256(UTF-8("EDUCONNECT:SESSION:" + lowercaseSessionUuid))
```

The database must persist both the UUID and the resulting `bytes32`. A session
UUID may be used by several student agreements because on-chain session state
is nested under `agreementId`.

## 3. State machines

### 3.1 Enrollment request and enrollment

```text
EnrollmentRequest: PENDING -> ACCEPTED | REJECTED | CANCELLED

Enrollment: RESERVED -> ACTIVE -> COMPLETED
                        |          |
                        +-> CANCELLED
             RESERVED -> EXPIRED
```

`EnrollmentRequest.ACCEPTED` only reserves capacity. It is not proof that the
student paid and must not grant classroom access. The only activation trigger
is `contract.activated.v1`, emitted after the funded transaction and event have
been independently confirmed.

The current Learning Service has no separate `Enrollment` entity and counts an
accepted request as a participant. That behavior is an integration gap for a
later phase, not a P0 code change.

### 3.2 Contract agreement in Contract Service

```text
DRAFT
-> PENDING_TUTOR_ACCEPTANCE
-> PENDING_STUDENT_ACCEPTANCE
-> PREPARING_BLOCKCHAIN
-> WAITING_PAYMENT
-> PAYMENT_CONFIRMING
-> ACTIVE
-> COMPLETED

WAITING_PAYMENT -> EXPIRED
ACTIVE -> CANCELLED
```

Rules:

- Tutor accepts first, then Student accepts the exact same `termsHash` and
  `contractVersion`.
- Acceptance is an audited application action, not an EIP-712/PDF signature.
- `WAITING_PAYMENT` is entered only after `AgreementRegistered` is confirmed.
- `ACTIVE` is entered only after a successful receipt and a matching
  `AgreementFunded` event.
- No arbitrary state jump is valid.

### 3.3 Payment mirror in Contract Service

```text
NOT_STARTED
-> APPROVAL_PENDING
-> DEPOSIT_PENDING
-> CONFIRMING
-> LOCKED
-> PARTIALLY_RELEASED
-> SETTLED | REFUNDED

APPROVAL_PENDING | DEPOSIT_PENDING | CONFIRMING -> FAILED_RETRYABLE
NOT_STARTED | FAILED_RETRYABLE -> EXPIRED (when the on-chain deadline passes)
```

A transaction hash is never proof of success. `LOCKED`, `ACTIVE`, `SETTLED`,
and `REFUNDED` require a successful receipt plus the expected event from the
configured chain and contract.

### 3.4 Agreement on-chain

```text
NONE -> CREATED -> FUNDED -> COMPLETED
          |          |
          v          v
       EXPIRED    CANCELLED
```

### 3.5 Session settlement in Contract Service/on-chain

```text
NONE -> PROPOSED -> SETTLED
                    ^
                    |
          DISPUTED -+-> REFUNDED
             ^
             |
          PROPOSED
```

- A session can be proposed once and reach one final state once.
- `settledSessions` means processed final sessions, including full-refund
  outcomes. It increments once for either `SETTLED` or `REFUNDED`.
- An agreement cannot be cancelled while any session is `PROPOSED` or
  `DISPUTED`.

## 4. Canonical terms V1

The canonical terms are compact UTF-8 JSON. Object keys use the exact order
below, there is no insignificant whitespace, Ethereum addresses are lowercase
`0x` hex, UUIDs are lowercase canonical strings, timestamps are UTC ISO-8601,
and all monetary values are decimal strings in their stated unit.

```json
{"schema":"educonnect.escrow-terms.v1","contractVersion":1,"agreementUuid":"00000000-0000-0000-0000-000000000000","classroomId":"1","studentId":"1","tutorId":"2","studentWallet":"0x0000000000000000000000000000000000000001","tutorWallet":"0x0000000000000000000000000000000000000002","platformWallet":"0x0000000000000000000000000000000000000003","chainId":11155111,"escrowContractAddress":"0x0000000000000000000000000000000000000004","tokenAddress":"0x1c7d4b196cb0c7b01d743fbc6116a902379c7238","tokenSymbol":"USDC","tokenDecimals":6,"totalPriceVnd":"1000000","vndPerUsdc":"25000","totalAmountUsdcUnits":"40000000","pricePerSessionUsdcUnits":"4000000","totalSessions":10,"paymentWindowSeconds":86400,"disputeWindowSeconds":86400,"bothPresentTutorBps":8500,"bothPresentPlatformBps":1500,"studentAbsentTutorBps":4500,"studentAbsentPlatformBps":1000,"studentAbsentRefundBps":4500,"tutorAbsentRefundBps":10000,"cancellationPolicy":"REFUND_UNUSED_AFTER_OPEN_SESSIONS_RESOLVED"}
```

Hashing rule:

```text
termsHash = keccak256(canonicalJson UTF-8 bytes)
```

Java uses Web3j `Hash.sha3(...)`; Solidity receives the resulting `bytes32`.
PDF/rendered documents are presentations and are never the hash source.

Before either party accepts, Contract Service must validate:

```text
totalAmountUsdcUnits = pricePerSessionUsdcUnits * totalSessions
tokenDecimals = 6
chainId, tokenAddress and escrowContractAddress match runtime configuration
studentWallet != tutorWallet
all wallet/contract addresses are non-zero
```

Any change to a hashed field creates a new `contractVersion`, a new canonical
JSON document, a new hash, and new acceptances. Old acceptance rows are retained
for audit.

## 5. Payment-window decision

Decision `P0-001`: the 24-hour payment window starts from the block timestamp
of `registerAgreement`. The Solidity implementation will compute
`paymentDeadline = block.timestamp + 24 hours`; it will not accept an arbitrary
deadline from the operator.

This preserves the master guide's business rule that the window starts when
registration is on-chain and removes caller-controlled deadline variation. It
changes the suggested Solidity function signature by removing the
`paymentDeadline` argument. Contract Service stores the deadline read from the
confirmed on-chain agreement/event and uses that value in the UI and scheduler.

## 6. Attendance outcome and payout rules

Attendance is finalized by Learning Service. Contract Service maps it as:

| Tutor | Student | On-chain outcome |
| --- | --- | --- |
| Present | Present | `BOTH_PRESENT` |
| Present | Not present | `STUDENT_ABSENT_TUTOR_PRESENT` |
| Not present | Present or not present | `TUTOR_ABSENT` |

Payouts use basis points (`10_000 = 100%`):

| Outcome/final decision | Tutor | Platform | Student refund |
| --- | ---: | ---: | ---: |
| `BOTH_PRESENT` | 8,500 bps | 1,500 bps | remainder |
| `STUDENT_ABSENT_TUTOR_PRESENT` | 4,500 bps | 1,000 bps | remainder |
| `TUTOR_ABSENT` | 0 | 0 | 10,000 bps |
| Complaint approved | 0 | 0 | 10,000 bps |
| Complaint rejected | 8,500 bps | 1,500 bps | remainder |

Integer rounding assigns the remainder to the final recipient:

```text
tutorAmount = sessionAmount * tutorBps / 10_000
platformAmount = sessionAmount * platformBps / 10_000
studentRefund = sessionAmount - tutorAmount - platformAmount
```

Therefore every final session must satisfy:

```text
tutorAmount + platformAmount + studentRefund = pricePerSession
```

## 7. Dispute V1

The only V1 dispute type is `TUTOR_FRAUD`. It is valid only when:

- both Tutor and Student attendance are `PRESENT`;
- the complainant is the Student of that agreement;
- server `submittedAt <= disputeDeadline`;
- the session is still `PROPOSED` with outcome `BOTH_PRESENT`.

The 24-hour limit controls submission only. Once opened, the session remains
blocked until an arbitrator resolves it, even after the deadline.

Staff/Admin may resolve disputes before the 24-hour submission window ends.
That decision applies only to the disputes selected or matched by the current
bulk action. New valid disputes submitted later, but still before
`disputeDeadline`, remain accepted and must be resolved in a later action.

Resolution is binary:

- `APPROVED`: refund the Student 100% of that session.
- `REJECTED`: pay Tutor/Platform 85%/15%.

An arbitrator cannot enter custom percentages. A dispute affects only one
`agreementId + sessionId`, never every student in a classroom.

Bulk resolution is an application/API convenience, not a different on-chain
rule. It may approve or reject many already-open valid disputes for the same
classroom/session in one Staff/Admin action, but Contract Service still creates
one `RESOLVE:{chainId}:{agreementId}:{sessionId}` command per student agreement,
with separate audit and receipt tracking. Bulk resolution must not refund
students who did not submit a valid dispute.

Application-level authorization is narrower than the on-chain arbitrator role:

- `ADMIN` can view and resolve every dispute.
- `STAFF` can view and resolve only disputes for a classroom that the same Staff
  approved. V1 compares the authenticated email with Learning Service's
  `ClassRoom.reviewedByEmail` case-insensitively.
- If reviewer ownership cannot be established, only `ADMIN` may resolve.
- Contract Service obtains this authorization from Learning Service through an
  internal API/read model before enqueueing the blockchain transaction. It must
  not query Learning Service's database directly.
- The shared `ARBITRATOR_ROLE` signer is a technical transaction authority, not
  proof that the requesting Staff owns the classroom review.
- The decision audit stores resolver identity/role, reason, timestamp, and tx hash.
- Bulk decisions store the same resolver identity/role, reason, timestamp, bulk
  decision identifier, and per-dispute tx hash. Partial on-chain failures remain
  retryable per dispute and do not authorize duplicate refunds.

## 8. Cancellation and expiration

- An unfunded `CREATED` agreement can expire after its on-chain payment
  deadline. No token transfer occurs.
- A funded agreement can be cancelled only by `ARBITRATOR_ROLE` in V1 and only
  when no session is `PROPOSED` or `DISPUTED`.
- Cancellation refunds exactly `remainingAmount`; already finalized session
  payouts/refunds never change.
- No unused amount belongs to the platform.

## 9. Roles and permitted calls

| Function | V1 caller |
| --- | --- |
| `registerAgreement` | `OPERATOR_ROLE` |
| `fundAgreement` | exact agreement Student wallet |
| `proposeSessionSettlement` | `OPERATOR_ROLE` |
| `openTutorFraudDispute` | `OPERATOR_ROLE` after API validation |
| `finalizeSession` | `OPERATOR_ROLE` scheduler |
| `resolveTutorFraudDispute` | `ARBITRATOR_ROLE` |
| `expireAgreement` | `OPERATOR_ROLE` |
| `cancelAgreementAndRefundUnused` | `ARBITRATOR_ROLE` |
| `pause`/`unpause` | `DEFAULT_ADMIN_ROLE` |

Account 1 may hold every platform role in V1. The contract still keeps roles
separate. There is no unrestricted admin withdrawal/transfer function.

The `resolveTutorFraudDispute` role check deliberately remains coarse on-chain.
The ADMIN/STAFF classroom-reviewer scope above is enforced before Contract
Service uses that signer.

Pause blocks new registration, funding, proposal, and ordinary finalization.
Dispute resolution and valid refunds remain available so funds cannot be frozen
forever.

## 10. Service ownership and event contract

| Data/action | Owner | Other services interact through |
| --- | --- | --- |
| Wallet address and account identity | Account Service | REST/read model |
| Classroom, request, enrollment, session, attendance | Learning Service | REST + versioned events |
| Agreement, acceptance, payment mirror, settlement, dispute | Contract Service | Contract APIs/events |
| Escrow USDC and final on-chain state | `EduConnectEscrow` | RPC, receipt, decoded event |
| Notifications | Notification Service | versioned events |

Required event sequence:

```text
Learning: enrollment.request.accepted.v1
-> Contract: creates agreement draft idempotently

Blockchain: AgreementFunded
-> Contract: confirms LOCKED/ACTIVE
-> Contract: contract.activated.v1
-> Learning: activates Enrollment idempotently

Learning: session.attendance.finalized.v1
-> Contract: proposes settlement idempotently

Blockchain: SessionSettled or TutorFraudDisputeResolved
-> Contract: confirms final state
-> Contract: settlement.completed.v1
-> Notification: informs affected users
```

Every event envelope contains `eventId`, versioned `eventType`, `occurredAt`,
`producer`, `correlationId`, and `payload`. Blockchain-related payloads also
contain `chainId`, `contractAddress`, `agreementId`, `txHash`, and `blockNumber`.
No service sends a JPA entity over RabbitMQ or updates another service's tables.

## 11. Idempotency and reconciliation invariants

Required unique identities:

```text
ContractAgreement: classroomId + studentId + contractVersion
SessionSettlement: agreementId + sessionId
BlockchainTransaction: idempotencyKey
BlockchainEvent: chainId + transactionHash + logIndex
ProcessedEvent: consumerName + eventId
```

Required transaction command keys include:

```text
REGISTER:{chainId}:{agreementId}
PROPOSE:{chainId}:{agreementId}:{sessionId}
OPEN_DISPUTE:{chainId}:{agreementId}:{sessionId}
FINALIZE:{chainId}:{agreementId}:{sessionId}
RESOLVE:{chainId}:{agreementId}:{sessionId}
CANCEL:{chainId}:{agreementId}
EXPIRE:{chainId}:{agreementId}
```

On-chain invariants:

```text
escrow token balance >= sum(active agreement remainingAmount)
0 <= remainingAmount <= totalAmount
processed final sessions <= totalSessions
released + refunded + remaining = funded per agreement
final session state cannot return to PROPOSED or DISPUTED
```

In normal demos with no direct accidental ERC-20 transfer, escrow balance must
equal the sum of all remaining agreement amounts.

## 12. P0 acceptance checklist

- [x] One master contract with multiple isolated agreements.
- [x] Contract, Payment, Enrollment, Agreement, and Session transitions defined.
- [x] Canonical terms schema and Keccak-256 rule defined.
- [x] Three attendance outcomes and exact payout rules defined.
- [x] Payment and dispute windows fixed at 24 hours.
- [x] Individual dispute scope and binary resolution defined.
- [x] Cancellation refunds only unused funds.
- [x] Service/table/event ownership defined.
- [x] Receipt/event confirmation and idempotency rules defined.
- [x] Current Learning Service integration gap recorded without modifying it.
