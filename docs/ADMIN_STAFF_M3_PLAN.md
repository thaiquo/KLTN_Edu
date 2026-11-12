# ADMIN/STAFF M3 PROPOSED PLAN

> **Status:** PROPOSED - NOT APPROVED - NOT IMPLEMENTED  
> **Date:** 2026-11-11  
> **Scope:** Admin/Staff operations only. This is not the existing Mobile M3 milestone.

## 1. Context and objective

The repository does not currently define an official Admin/Staff M3. M1 establishes role and resource authorization; M2 provides operational review/escalation workflows; Staff Duty Roster adds time-based write eligibility. The proposed M3 should improve operational governance and observability without changing domain ownership, financial authority, blockchain flows, or Student/Tutor business rules.

Objective: give Admin and Staff a measurable, auditable operational workflow with clear ownership, service-level visibility, and safe recovery when a downstream service is unavailable.

## 2. Scope classification

### Required before implementation approval

- Close the remaining M1/M2 acceptance gaps: real browser route-guard walkthrough and an isolated on-duty Staff reviewer/assignee scope E2E fixture.
- Confirm which queues require explicit assignment and which remain shared pull queues.
- Confirm SLA targets per workflow and whether overdue status is informational or drives escalation.

### Proposed M3 capabilities

- Unified operational work item projection for approvals, moderation, disputes, terminations and support tickets, referencing owner-service IDs rather than duplicating domain entities.
- Explicit assignment/claim/reassign history where the owner service already supports an assignee.
- SLA age, overdue indicators and Admin escalation view based on confirmed business deadlines.
- Operational audit search/export with stable event identity and source traceability.
- Health/partial-data indicators for Gateway aggregation, including source latency and last successful refresh.
- Admin configuration for operational thresholds only; no runtime editing of security, finance or blockchain policy.

### Out of scope

- AI auto-approval or AI decision making.
- New payment, settlement, refund or escrow authority.
- Replacing owner-service authorization with a Gateway-only check.
- A new microservice or duplicated workflow database.
- Mobile parity, Student/Tutor workflow redesign, or notification marketing automation.

## 3. Business and authorization rules

- Admin can view all operational work items and perform only actions already allowed by the owner service.
- Staff sees shared queues or assigned resources according to each domain's existing policy; duty status remains a second write gate.
- Assignment never overrides reviewer, classroom, ticket or dispute ownership rules.
- Financial overview/global settlements/global transactions remain Admin-only.
- Every claim, reassign, escalation, deadline override and final action records actor, active role, reason, source ID and timestamp.
- Aggregation fails visibly per source; unavailable data is never represented as zero.

## 4. Delivery phases

### M3.1 - Acceptance fixtures and contract baseline

- Add isolated integration fixtures for on-duty/off-duty Staff and assigned/unassigned dispute, termination and ticket resources.
- Define a versioned operational work-item read contract at the Gateway; owner services remain authoritative.
- Document SLA definitions, status mapping and deduplication keys.

Acceptance:
- Browser deep-link/back/forward/logout tests pass for Admin and Staff.
- Staff on duty still receives 403/404 according to owner-service scope for an unassigned resource.
- Contract tests prove no Admin-only finance fields enter Staff responses.

### M3.2 - Unified operations and assignment visibility

- Implement server-side paged work-item aggregation with source, status, assignee, age and priority filters.
- Add assignment/claim controls only for workflows whose owner service supports them.
- Add clear partial-source, empty, loading and retry states in the portal.

Acceptance:
- Pagination is capped at 10/50 and totals are full-filter totals.
- Concurrent claim/reassign is serialized and audited.
- Direct API and deep-link attempts cannot bypass role, duty or resource scope.

### M3.3 - SLA and escalation governance

- Calculate age/overdue state from confirmed per-domain clocks and terminal statuses.
- Add Admin overdue/escalation views and Staff due-soon views.
- Reuse Bell notifications only for actionable threshold transitions with idempotent event IDs.

Acceptance:
- Clock-boundary and timezone tests pass.
- Retries do not duplicate escalation or notifications.
- An unavailable source produces an explicit unknown state, never a false on-time/zero result.

### M3.4 - Audit, observability and release hardening

- Add searchable cross-domain audit references and bounded CSV export.
- Add source latency/error metrics and a runbook for partial aggregation failure.
- Complete production-like browser, HTTP and PostgreSQL concurrency acceptance.

Acceptance:
- Export respects filters, authorization and row limits.
- Audit entries link back to source records without copying sensitive payloads.
- Full Account/Learning/Contract/Gateway/frontend regression passes.

## 5. Expected implementation surfaces

- **Gateway:** read aggregation, summary, bounded export, source-health metadata; no domain writes.
- **Account:** Staff identity, duty and ticket/assignment ownership where already owned.
- **Learning:** approval and Community work-item projections; existing reviewer rules remain authoritative.
- **Contract:** dispute/termination projections and scope checks; finance remains Admin-only.
- **Frontend:** unified operational workspace, source-health states, SLA indicators and role/duty-aware actions.
- **Database:** only additive migrations in the owning service if confirmed assignment/SLA persistence is required; never rewrite applied Flyway migrations.

## 6. Test strategy

- Unit tests for status mapping, deduplication, SLA boundaries and partial-source behavior.
- Controller/security tests for Admin, on-duty Staff, off-duty Staff, Student, Tutor and unauthenticated requests.
- Contract tests for pagination, sorting, totals and finance-field exclusion.
- PostgreSQL integration tests for concurrent claim/reassign and idempotent escalation.
- Browser E2E for menu visibility, `?tab=` deep links, refresh, back/forward, role switch, duty transition and 403 handling.
- Regression for tutor/class approval, Community moderation, dispute, termination, support ticket, contract and blockchain read flows.

## 7. Risks and mitigations

- **Cross-service status drift:** use explicit mapping and source IDs; do not infer from labels.
- **Duplicate work items:** define stable `(source, domain, resourceId, workflowRevision)` keys.
- **Authorization leakage:** fetch through user-context calls and keep owner-service checks mandatory.
- **SLA ambiguity:** do not implement timers until business deadlines and pause conditions are confirmed.
- **Large reports:** aggregate server-side, cap page size/export and expose truncation clearly.

## 8. Decisions still required

1. Which queues are claimable versus shared?
2. SLA target and pause/stop conditions for each workflow?
3. Which overdue transitions notify Staff, Admin, or both?
4. Is an Admin override allowed for assignment only, SLA deadline only, or neither?
5. Required retention period and fields for cross-domain operational audit export?

## 9. Definition of Done

- Remaining M1/M2 browser and resource-scope acceptance gaps are closed.
- All approved M3 phases meet their acceptance criteria with automated and runtime evidence.
- Owner-service authorization, activeRole, cookie/CSRF, duty gating and finance isolation have no regression.
- PostgreSQL concurrency and idempotency scenarios pass.
- Portal is responsive and handles loading, empty, partial, error and retry states.
- Documentation and API contracts match deployed source.
- No M3 item is marked implemented until its source, tests and runtime path are verified.
