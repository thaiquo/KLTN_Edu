# Current master escrow hardening — 2026-09-12

## Confirmed direction

Keep the existing Sepolia master escrow `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`.
No Solidity deployment, ABI replacement, token rescue or migration of funded agreements is required by this change.
Sepolia ETH pays gas; six-decimal USDC is the escrow asset.

## Legacy reconciliation

Four agreements in classrooms 1 and 2 were verified absent on-chain although their local status was ACTIVE.
Historical direct ERC-20 transfers total 38.4 test USDC. These tokens are excess contract balance, not agreement liabilities.
V1 has no rescue function. Leave that balance in place and preserve the historical payment hashes.

Flyway V9 adds `contract_agreement.legacy_excluded` and quarantines only the four previously audited UUIDs,
on the exact Sepolia deployment, if they still lack a matching funding event. Their ten unbroadcast settlements
become `EXCLUDED_LEGACY`. Their failed transaction records remain FAILED for audit; they must never be retried.
This flag does not change signed terms or pretend an on-chain cancellation/refund occurred.

The verified agreement `6355b191-333a-426b-8f24-a1f06177fd4c` in classroom 4 stays operational.
Its initial escrow is 4.8 USDC over eight sessions. The proposal transaction is
`0x2511a109e392c1ef0f981690e37cbc754a43cee233a6222b648823b4075f5e43`.
The first dispute window ends at **2026-09-12 18:54:24 GMT+7**.
For its 0.6 USDC BOTH_PRESENT session, expected transfers are 0.51 to tutor and 0.09 to platform.
That is an expectation, not evidence of a mined payout. Confirm `SessionSettled` before reporting success.

## Implemented application changes

- Shared `OperationalFundingPolicy` checks the exact event emitter, chain, funding transaction, agreement ID,
  student wallet and amount. Both command creation and dispatch use it; a local ACTIVE status cannot authorize spending.
- Newly created intents use the configured operator as sender rather than assuming the fee beneficiary is the signer.
- A failed intent cannot silently be returned as a successful new proposal.
- Known failures before signing or with a reverted receipt are reflected in settlement/dispute failure states.
- A missing receipt remains under observation. An uncertain broadcast can resend the same signed bytes and nonce;
  it cannot create a second logical payment. Existing legacy FAILED transactions with an unknown receipt resume observation.
- The queue does not prepare another transaction for a sender while that sender has a DISPATCHING transaction.
  This runtime is intended for one operator service instance; distributed signer coordination is not implemented.
- Admin-only `POST /api/contracts/transactions/{id}/retry` validates funding, deadline and domain state.
  Previous hash, nonce, receipt, error and actor are retained in a transactional outbox audit before retry.
  Unknown outcomes, quarantined records, terminal settlements and expired dispute openings are rejected.
- Operator startup validates deployment, token, chain, signing credential, both required roles and nonzero ETH balance.
- Wallet/accounting responses include remaining escrow, confirmed released/refunded totals and the funding hash.
  Legacy rows are excluded from financial KPIs. Confirmed payouts are never estimated from proposal percentages.
- Settlement verification matches Solidity rounding exactly: floor tutor and platform shares separately,
  then refund any base-unit remainder to the student.
- New agreement requests persist a canonical complete terms snapshot and hash. Both party wallets must be
  nonzero, distinct and fixed before signing. The existing `contract-terms-v2` JSON schema is an off-chain document
  schema, **not a new Solidity contract or deployment**. Existing signed agreements are not rewritten.
- Contract, wallet and dispute screens refresh periodically and distinguish queued work from confirmed money movement.

## Verification

- Contract-service Maven tests/package passed; isolated Anvil tests are additionally run with explicit flags.
- `node scripts/test-escrow-local.cjs` starts its own Anvil on localhost:18545, deploys the current source only there,
  and tests register/fund/propose/finalize and dispute/open/approve/refund through backend workflows and event ingestion.
  It checks the test reports to reject skipped tests and mocks external notification/enrollment delivery.
- All 35 Solidity unit/fuzz/invariant tests pass. An additional regression test proves that direct-transfer excess cannot
  change the valid agreement's payout/refund accounting.
- TypeScript checking and Vite production build pass. Verification build output is under `frontend-web/.runtime/build-check`.
- Before live migration, PostgreSQL was backed up to `.local-backups/educonnect-before-escrow-fix-20260912.dump`.
- Runtime Flyway V9 was applied successfully: four legacy flags, ten EXCLUDED_LEGACY settlements, one valid PROPOSED settlement.
- At 18:03 GMT+7 the restarted runtime validated the existing deployment and enabled the configured operator.
  At 18:08 the Sepolia event cursor had reached block 11688523; the valid settlement was still PROPOSED, before its deadline.
- At 18:55:22 GMT+7 the automated scheduler dispatched the finalize transaction `0xd835b8ae250b20141feb32d26eb081ca1a0d532c9c6780b9622812c91990dc2a`.
  It was confirmed at block 11688753 (receipt_status: 1). Payout verified: 0.51 USDC to tutor, 0.09 USDC to platform, 4.2 USDC remaining in escrow.
- The configured primary RPC was changed to Alchemy. This is a single configured endpoint, not an implemented multi-endpoint fallback; transient RPC failures remain visible in service logs and the event cursor retries without advancing on error.
- The final isolated Anvil rerun passed both integration tests with no skips and no Sepolia transactions.

## Operational limits and reporting

The on-chain 24-hour window is immutable in this deployment. An application request is not an on-chain dispute
until its transaction confirms. A failed dispute opening that misses that deadline requires explicit operational
review; the software must not fabricate an opened dispute, silently dismiss it, or claim it can retry after expiry.
V1 only supports tutor-fraud disputes for BOTH_PRESENT. Broader complaint outcomes require a separate confirmed design.

Keep one Contract operator instance and Learning running. Monitor gas, event cursor progress, failed intents and
overdue proposals. Finalization catches up after restart; Solidity does not execute itself.
`scripts/restart-contract-service.ps1` starts the packaged current application with root `.env`, validates the existing
port owner before stopping it, and writes runtime logs under ignored `.runtime/contract-service`.
This verification confirms the first live Sepolia payout completed successfully according to the master contract rules.
`scripts/audit-settlement-receipt.cjs` performs a read-only receipt audit using the current compiled Solidity ABI. It verifies the canonical block, `SessionSettled` event, ERC-20 transfers, session conservation and agreement conservation for a supplied transaction hash.
