# Admin/Staff M3 SLA Policy

> Source audit and local implementation evidence: 2026-11-17. These timers are informational queue-health targets. They do not auto-approve, auto-reject, settle, refund, or change owner-service authorization.

## Policy table

| Source | Deadline before M3.3 | M3.3 evaluation | Default target | Due-soon window |
| --- | --- | --- | --- | --- |
| Tutor Application | No official operational deadline found | New configurable queue target | 3 days | 1 day |
| Teaching Registration | No official operational deadline found | New configurable queue target | 3 days | 1 day |
| Class Approval | No official operational deadline found | New configurable queue target | 2 days | 12 hours |
| Community Moderation | No official operational deadline found | New configurable queue target | 1 day | 4 hours |
| Support Ticket | Timestamp and assignee exist; no priority/SLA field | New configurable queue target | 2 days | 8 hours |
| Dispute | Tutor-response deadline exists in Contract domain | Owner-service `dueAt` wins | Owner deadline | 6 hours |
| Termination | Some lifecycle paths expose a real response/deadline; no universal deadline | Owner-service `dueAt` wins; otherwise `NOT_APPLICABLE` | Owner deadline only | 6 hours |

Defaults are configured by `operations.sla.*` in API Gateway and can be overridden by environment variables. They are not embedded in React.

## Evaluation rules

- Terminal work items are `NOT_APPLICABLE`.
- A real owner-service deadline always has priority over a configured queue target.
- Without an owner deadline or a configured source policy, the result is `NOT_APPLICABLE`; no `dueAt` is invented.
- `DUE_SOON` means the current time is inside the source warning window and before `dueAt`.
- `OVERDUE` means current time is equal to or later than `dueAt`.
- Time values from source APIs without an offset are interpreted in `Asia/Ho_Chi_Minh`.
- Staff duty status does not pause an organization-level queue clock.
- No verified domain pause state was found that can be applied consistently across all seven sources, so M3.3 does not create a synthetic pause. `slaPaused=false` and `slaPauseReason=null`.

## Stable identity

The SLA projection uses `(source, resourceId, workflowRevision)`. A source version/content revision is used when present. Otherwise the fallback is the current status plus its transition timestamp. Display labels and UI indexes are never identities.

## Partial-source behavior

Unavailable sources remain explicit in the source-health list. Their overdue/due-soon values are unknown (`null` at source level), never zero. Summary truncation is also exposed when the bounded source fetch cannot cover every item.

## Bell notification decision

Implemented in M3.3 for `DUE_SOON` and `OVERDUE` work items. Evaluation is triggered when the bounded Action Center page is loaded; there is no background timer in Gateway. A shared/unassigned item targets active Admin recipients, while an assigned item targets active Admin recipients plus the matching active Staff assignee.

The durable deduplication identity is derived from `(source, resourceId, workflowRevision, slaState)` and hashed into an event ID shorter than the Notification schema limit. Repeated polling therefore reuses the same event ID. Notification Service persists at most one row per `(event_id, recipient_user_id)` through its existing unique constraint and `createIfAbsent` path. A new workflow revision or a transition from `DUE_SOON` to `OVERDUE` intentionally creates a new actionable notification.

Bell delivery is best effort: recipient resolution or Notification Service failure never changes the Work Item response or owner-service state. Runtime acceptance used three isolated local Support Ticket fixtures and proved `NORMAL`, `DUE_SOON`, and `OVERDUE`; repeated Action Center requests kept the Bell row count at three (one assigned Staff plus Admin for due-soon, Admin for unassigned overdue). All fixture tickets and notifications were deleted after verification.
