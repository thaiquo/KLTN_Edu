# Admin/Staff M3 Operational Scope Matrix

> Verified against source on 2026-11-17. This matrix documents existing semantics; it does not grant new authority.

## Work-item V1 identity

The Gateway read contract is `GET /api/operational-work-items/v1` and returns `contractVersion = V1`.
The stable identity is `(source, resourceId, workflowRevision)`. `workflowRevision` uses an owner-service
version/revision when present and otherwise a deterministic status/update value. `dueAt` is null unless the
owner service already supplies a real deadline.

## Queue policy

| Source | Shared queue | Claimable | Reassignable | Staff scope | Admin override |
| --- | --- | --- | --- | --- | --- |
| Tutor Application | Yes | No | No | Pending queue; processed history scoped by reviewer | Existing review authority only |
| Teaching Registration | Yes | No | No | Pending queue; processed history scoped by reviewer | Existing review authority only |
| Class Approval | Yes | No | No | Pending queue; processed/detail scope follows `reviewedByEmail` | Existing review authority only |
| Community Moderation | Yes | No | No | Shared moderation queue; duty gate applies to mutations | Existing moderation authority only |
| Support Ticket | Unassigned tickets only | Yes | No dedicated reassign API | Unassigned or assigned-to-current Staff | Admin can view/manage all existing tickets |
| Dispute | No | No | No | `classroomReviewerEmail` must match Staff | Admin can view and resolve globally |
| Termination | No | No | No | Assigned classroom reviewer can view; Staff cannot make final financial decision | Admin owns final decision |

## Partial-source rules

- A 5xx/network/invalid-response failure is represented as `UNAVAILABLE` with a short error code.
- Authentication and authorization failures remain 401/403 for the whole request and are never downgraded.
- Successful sources remain visible and unavailable totals are `null`, not zero.
- CSV exports declare successful and unavailable sources before the activity rows.
- No stale cache is served and `lastSuccessfulRefresh` refers only to the current successful fetch.

## Deliberately unsupported in M3.2 foundation

- No synthetic assignment for shared approval or Community queues.
- No dispute/termination claim or reassign endpoint.
- No inferred SLA deadline. Existing dispute/termination deadlines are passed through unchanged.
- No Gateway-owned workflow database or mutation authority.
