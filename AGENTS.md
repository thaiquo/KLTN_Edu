# EduConnect Agent Instructions

## Project Source of Truth

When working inside this repository, use this priority order:

1. The latest user-confirmed request.
2. Current source code related to the task.
3. Core baseline/reference documentation in `/docs`.
4. Existing legacy docs, only when still useful as historical context.

The Markdown files in `/docs` are the core baseline/reference for EduConnect. They summarize the project direction, confirmed business rules, architecture baseline, security baseline, blockchain/AI direction, and implementation status at the time of audit.

Do not require or search for any thesis DOCX/Word file, thesis chapter, or external document as runtime project context. The needed baseline has already been summarized into repository Markdown.

## Agent Workflow

When asked to implement, fix, refactor, or extend functionality, do not start by scanning the entire repository.

### Step 1 - Read Agent Rules

- Read `/AGENTS.md`.

### Step 2 - Read Relevant Documentation

Always read:

- `docs/PROJECT.md`
- `docs/IMPLEMENTATION_STATUS.md`

Then read additional domain docs only when relevant. If a referenced doc does not exist yet, continue by auditing the related source.

### Step 3 - Determine Scope

Use the task and docs to identify the likely domain/service/module:

- Auth, role, security -> account-service and security docs.
- Class, homework, session -> learning-service and business/architecture docs.
- Contract, payment, escrow -> contract-service and blockchain docs.
- AI matching -> AI docs and related search/profile/class data.

### Step 4 - Audit Relevant Source

Audit only source within the determined scope first. Check what matters for the task:

- Entity/Model
- Repository
- Service
- Controller/API
- DTO
- Migration
- Config
- Event/message
- Frontend component
- Mobile screen
- Smart Contract
- Tests

### Step 5 - Expand Scope Only When Needed

Expand to another service/module only when you find a dependency, cross-service flow, shared domain, event integration, API dependency, security dependency, database ownership issue, or frontend/backend coupling.

### Step 6 - Decide Change

Only after understanding the current implementation should you propose or make changes.

## Documentation Routing

Always read first:

- `docs/PROJECT.md`
- `docs/IMPLEMENTATION_STATUS.md`

Read additionally when relevant:

- Business flow / Use Case -> `docs/BUSINESS_RULES.md`
- Service ownership / architecture / integration -> `docs/ARCHITECTURE.md`
- Authentication / authorization / JWT / role / CSRF / CORS -> `docs/AUTH_SECURITY.md`
- REST API / frontend-backend integration -> `docs/API.md`
- Contract / Blockchain / escrow / settlement / refund / dispute / Web3 -> `docs/BLOCKCHAIN.md`
- AI Matching / recommendation / embedding / semantic search -> `docs/AI_MATCHING.md`
- Write/state-change/realtime feedback or notification behavior -> `docs/FEEDBACK_NOTIFICATION_SPEC.md`

Entries marked `PLANNED` in `docs/FEEDBACK_NOTIFICATION_SPEC.md` are future architecture requirements only, not implementation requests.

If a file does not exist, do not fail the task. Continue with source audit for the related domain.

## Documentation Interpretation

- `/docs` provides baseline/context, not a full exhaustive specification.
- `/docs` is not a whitelist of every valid feature in source.
- A feature missing from docs is not automatically wrong.
- Do not delete a feature only because it is not mentioned in docs.
- Do not modify source just to mechanically force it to match docs.
- Docs show the project direction; source shows current implementation.
- When docs are high level, source may contain more detailed implementation.
- If docs and source differ only by additional feature detail or implementation detail, do not treat it as a conflict.
- If docs and source conflict with core architecture, business, security, blockchain, or AI rules, report the conflict before changing behavior.

## Architecture Guardrails

- EduConnect uses Service-Based Architecture.
- Do not rename it to Microservices Architecture without explicit confirmation.
- Do not create a new service without explicit confirmation.
- Do not move domain ownership without explicit confirmation.
- Do not duplicate Entity/domain ownership across services when an owner already exists.

## Business Guardrails

- Keep the five actors: Guest, Student, Tutor, Staff, Admin.
- Student and Tutor both participate in contract management.
- Student manages their own payment/escrow flow.
- Tutor tracks income/released funds.
- Student and Tutor both have messaging as a business capability.
- Admin payment management is administrative transaction monitoring, distinct from Student payment.
- AI Matching supports search/connection and does not need to be a standalone Use Case.

## Security Guardrails

- EduConnect uses JWT authentication.
- Browser authentication baseline is cookie-based access token handling.
- CSRF must be considered for cookie authentication.
- Do not switch to localStorage/sessionStorage/Bearer-only auth architecture without explicit confirmation.
- Do not change the role/active-role model without explicit confirmation.

## Blockchain Guardrails

- Solidity contracts are the source of truth for Smart Contract ABI/interface.
- Sepolia ETH is for gas.
- USDC/ERC-20 test token is the escrow asset according to the current implementation.
- Do not describe Sepolia ETH as the escrow asset.
- Do not treat Web3 flow as complete while frontend ABI/address configuration does not match Solidity/deployment evidence.

## Documentation Change Policy

Documentation can change. When the user confirms a new business rule, architecture decision, API design, security design, blockchain design, or AI design:

1. Identify affected docs.
2. Identify affected source.
3. Report impact for major changes.
4. Update related docs consistently when asked.
5. Do not leave docs contradicting each other.

The latest user-confirmed decision takes priority over an older baseline.

## Implementation Rule

- Do not implement based on documentation alone.
- Audit current relevant source before coding.
- Do not mark a feature `IMPLEMENTED` only because an Entity, Controller, UI, or config exists.
- Mark a feature `IMPLEMENTED` only when the main flow has enough source evidence.
