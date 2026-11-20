# EduConnect API Baseline

> Post-merge baseline: 2026-10-10. This file documents current API families verified from merged controllers and frontend clients. It is not a full OpenAPI dump.

## 1. API Principles

- Each service owns APIs for its domain.
- Browser clients use credentialed requests, HttpOnly cookies and CSRF for state-changing calls.
- Frontend/Mobile must not access databases directly.
- Internal service endpoints must be treated as service-token protected even when the Spring route itself is not a normal user-facing route.
- Do not document a standalone `/matching` product route. AI Matching is part of Tutor Marketplace, Class Marketplace and chatbot flows.

## Operational Work Items V1

`GET /api/operational-work-items/v1?page=0&size=10` provides a read-only, partial-source-safe projection for
Admin/Staff operational queues. The response uses `contractVersion: "V1"`; each item contains `source`,
`resourceId`, `workflowRevision`, `title`, `status`, `priority`, `assignee`, `createdAt`, `age`, nullable `dueAt`,
`actionUrl`, `claimable`, `sourceStatus`, `slaState`, `remainingMinutes`, `overdueByMinutes`, `slaPolicyId`,
`slaPaused`, and `slaPauseReason`. Source health contains `status` (`SUCCESS`, `DEGRADED`, or `UNAVAILABLE`),
`latencyMs`, process-lifetime `lastSuccessfulRefresh`, `checkedAt`, nullable `itemCount`, a short `errorCode`,
and a safe `errorSummary`. Owner services remain authoritative for access and mutations.

`GET /api/operational-work-items/v1/summary` returns queue-health counts for `NORMAL`, `DUE_SOON`,
`OVERDUE`, and `NOT_APPLICABLE`, plus per-source health and truncation. An unavailable source is explicit and
its source counts are unknown rather than zero. SLA policy and new configurable defaults are documented in
`ADMIN_STAFF_M3_SLA_POLICY.md`.

`GET /api/operations/health/v1` is an Admin-only diagnostic view over the same source-health and SLA summary.
It does not expose service URLs, tokens, stack traces, database details, or source payloads.

A configurable Gateway background scheduler evaluates the same bounded Work Item/SLA policy without requiring
Admin or Staff to open Action Center. It publishes best-effort persistent Bell alerts for `DUE_SOON` and
`OVERDUE`. The event identity is stable per source/resource/workflow revision/SLA state; Notification Service
remains the durable idempotency boundary. Shared items notify Admin, while assigned items notify Admin plus the
matching active Staff assignee. Source or Bell publication failure is isolated from the read API and later runs.

Account Service exposes `POST /api/support/tickets/{id}/reassign` to Admin. The request supplies the new active
Staff assignee and a reason; closed/resolved tickets and no-op reassignment are rejected. Pessimistic locking and
support-ticket history preserve previous/new assignee IDs and actor metadata.

The queue policy and identity rules are documented in `ADMIN_STAFF_M3_SCOPE_MATRIX.md`.

## Admin Analytics Dashboard V1

`GET /api/operations/dashboard/v1?rangeDays=30|90` is an Admin-only, partial-source-safe aggregate for the
Admin Dashboard charts. Its `operational` section reuses Operational Work Item V1 to return authoritative open
counts by business source, backend SLA counts, and bounded Staff assignment workload. Its `financial` section
proxies the Contract-owned trend without exposing wallet addresses, transaction hashes, service URLs, or tokens.
Each section has an independent `SUCCESS`, `PARTIAL`, or `UNAVAILABLE` status; an unavailable Contract source
does not turn operational counts into zero.

`GET /api/contracts/admin/financial-trend?rangeDays=30|90` is the Contract-owned Admin-only read endpoint. It
uses fixed aggregate SQL grouped by day for 30 days and week for 90 days, separated by token symbol/decimals.
`releasedAmount` is the finalized Tutor plus platform distribution from `SETTLED` sessions; `pendingAmount` is
the settlement amount in the real open settlement states; `refundAmount` combines finalized session refunds and
completed termination refunds; `contractValue` is the face value of agreements created in the selected period.
No currency conversion is performed and legacy-quarantined records are excluded.

## 2. Ownership Summary

| API family | Owning service |
| --- | --- |
| Auth, account, profile, Tutor application identity data, geography | `account-service` |
| Teaching catalog, tutor registration, availability, class, enrollment, sessions, homework, reviews, Community and Tutor Follow | `learning-service` |
| Contract, document, escrow, settlement, dispute, termination | `contract-service` |
| Bell notifications and human Student-Tutor chat | `notification-service` |
| Tutor/Class AI Matching, AI chatbot, semantic maintenance | `ai-service` |

## 3. Account APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register account. |
| `POST` | `/api/auth/verify-email` | Verify OTP. |
| `POST` | `/api/auth/resend-verification-otp` | Resend verification OTP. |
| `POST` | `/api/auth/login` | Login and set auth cookies. |
| `POST` | `/api/auth/refresh` | Refresh session. |
| `POST` | `/api/auth/switch-role` | Switch active role after eligibility checks. |
| `POST` | `/api/auth/logout` | Revoke/logout. |
| `GET` | `/api/auth/csrf` | CSRF bootstrap. |
| `POST` | `/api/auth/forgot-password` | Begin reset flow. |
| `POST` | `/api/auth/reset-password` | Complete reset flow. |
| `GET` | `/api/users/me` | Current user/profile. |
| `PUT` | `/api/users/me` | Update current user profile. |
| `PUT` | `/api/users/me/wallet` | Update wallet. |
| `POST` | `/api/users/me/avatar` | Upload avatar. |
| `PUT` | `/api/users/me/password` | Change password. |
| `GET` | `/api/reference/provinces` | Province list. |
| `GET` | `/api/reference/provinces/{provinceCode}/communes` | Commune list. |
| `GET` | `/api/reference/locations/snapshot` | Location snapshot for grounding/search. |

### Login protection contract

`POST /api/auth/login` keeps the existing credentialed cookie/CSRF flow and accepts an optional `turnstileToken`. Normal login does not require the field. After the Account Service email failure threshold is reached, the API returns `401` with `code: "LOGIN_CHALLENGE_REQUIRED"`; the client must obtain a Turnstile token and retry the same login request. Gateway IP throttling returns `429` with `code: "LOGIN_RATE_LIMITED"` and a numeric `Retry-After` header. Redis or Turnstile availability failures return `503` with `code: "LOGIN_PROTECTION_UNAVAILABLE"`. These codes are stable client contracts; messages are presentation text, not branching keys.

The Gateway limit applies only to the exact login POST route. CSRF bootstrap, preflight requests, refresh, logout, and unrelated APIs are not counted. A successful login continues to set the existing HttpOnly auth cookies and does not return JWT values in the response body.

Tutor/account related APIs include `/api/tutors`, `/api/tutors/search-v2`, `/api/tutors/{tutorProfileId}/detail-v2`, `/api/tutor-applications/**`, `/api/staff/tutor-applications/**`, `/api/staff/tutors/**`, and admin user management under `/api/admin/users`, `/api/users/admin`, `/api/staff/users`.

Staff Duty Roster APIs:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/account/staff/duty/my-roster?weekStartDate=...` | Staff xem lịch/availability của mình. |
| `POST` | `/api/account/staff/duty/availability` | Staff lưu bình chọn ca rảnh tuần tới. |
| `POST` | `/api/account/staff/duty/start-shift` | Staff nhận ca đã công bố. |
| `GET` | `/api/account/staff/duty/status` | Trạng thái duty/write hiện tại. |
| `GET` | `/api/admin/staff-duty/roster?weekStartDate=...` | Admin xem ma trận lịch. |
| `POST` | `/api/admin/staff-duty/draft?weekStartDate=...` | Tạo 12 slot bản nháp. |
| `POST` | `/api/admin/staff-duty/auto-assign?weekStartDate=...` | Tạo gợi ý theo availability, chưa công bố. |
| `POST` | `/api/admin/staff-duty/publish?weekStartDate=...` | Admin công bố thủ công tuần chưa bắt đầu. |
| `POST` | `/api/admin/staff-duty/recover-current-week` | Phân/công bố các ca còn lại; ca đã kết thúc thành `SKIPPED`. |
| `PUT` | `/api/admin/staff-duty/assignments/{id}` | Phân công thủ công ca draft. |
| `POST` | `/api/admin/staff-duty/assignments/{id}/replace` | Thay người ca đã công bố, chưa nhận/chưa kết thúc. |
| `GET` | `/api/admin/staff-duty/audits` | Xem audit điều phối. |

Operational Reporting API:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/operational-reports/activities` | Admin-only: tổng hợp nhật ký nghiệp vụ liên nhân viên; Gateway xác minh active role trước khi đọc các service nguồn. |

## 4. Learning Catalog and Tutor APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/teaching-catalog/program-types` | Program types. |
| `GET` | `/api/teaching-catalog/education-levels` | Education levels. |
| `GET` | `/api/teaching-catalog/categories` | Catalog categories. |
| `GET` | `/api/teaching-catalog/subjects` | Catalog subjects. |
| `GET` | `/api/teaching-catalog/levels` | Catalog levels. |
| `GET` | `/api/teaching-catalog/grounding-snapshot` | Catalog snapshot for AI grounding. |
| `POST/GET` | `/api/subject-requests/**` | Subject request/suggestion review flow. |
| `POST/GET` | `/api/catalog-subject-suggestions/**` | Catalog subject suggestions. |
| `GET/POST` | `/api/tutor/subject-registrations` | Tutor subject registrations. |
| `POST` | `/api/tutor/subject-registrations/batch` | Batch registration. |
| `GET/POST` | `/api/tutor/availability` | Tutor availability. |
| `GET` | `/api/tutor-subjects` | Tutor subject data. |
| `GET` | `/api/tutor-subjects/by-profile/{tutorProfileId}` | Tutor subjects by profile. |

## 5. Public Tutor Search and Reviews

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/tutors/search-v2` | Public Tutor Search V2 with manual filters. |
| `GET` | `/api/tutors/{tutorProfileId}/detail-v2` | Public Tutor Detail V2. |
| `GET` | `/api/public/tutors/search-data` | Public tutor capability/search data owned by Learning. |
| `GET` | `/api/public/tutors/{tutorId}/reviews` | Public tutor reviews. |
| `GET` | `/api/public/tutors/{tutorId}/rating-summary` | Rating summary. |
| `GET` | `/api/public/tutors/rating-summaries` | Batched rating summaries. |

## 6. Class, Enrollment, Session and Homework APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/tutor/classes` | Tutor class list/create. |
| `GET` | `/api/tutor/classes/stats` | Tutor class stats. |
| `GET/PUT/DELETE` | `/api/tutor/classes/{id}` and subpaths | Tutor class detail/update/visibility/delete. |
| `GET` | `/api/admin/classes` | Staff/Admin class monitoring. |
| `POST` | `/api/admin/classes/{id}/approve` | Approve class. |
| `POST` | `/api/admin/classes/{id}/reject` | Reject class. |
| `GET` | `/api/public/classes` | Public class search. |
| `GET` | `/api/public/classes/{id}` | Public class detail. |
| `GET` | `/api/public/classes/{id}/share` | Shareable class detail for `/classes/{id}`. |
| `GET` | `/api/public/classes/shared/{publicShareId}` | Public class detail resolved from an opaque share UUID; only `PUBLISHED` classes are returned. |
| `POST` | `/api/public/classes/{id}/verify-key` | Verify join key. |
| `GET` | `/api/public/classes/semantic-source` | Public-safe class source for AI indexing/validation. |
| `POST` | `/api/classes/{classId}/enroll` | Student enroll/request join; a successful `PENDING` request immediately reserves the recurring slot. Returns `409` with code `STUDENT_SCHEDULE_CONFLICT` when it overlaps another `PENDING`/`ACCEPTED`/`ENROLLED` reservation. |
| `GET` | `/api/student/classes` | Student classes. |
| `GET` | `/api/student/schedule` | Student schedule, including safe recurring reservations with `enrollmentStatus=PENDING/ACCEPTED/ENROLLED`; concrete sessions remain limited to enrolled/history flows. |
| `GET` | `/api/enrollment-requests/my-requests` | Student request list. |
| `POST` | `/api/enrollment-requests/{requestId}/cancel` | Cancel request. |
| `POST` | `/api/enrollment-requests/{requestId}/accept` | Tutor accept; rechecks the Student schedule and returns `409 STUDENT_SCHEDULE_CONFLICT` on a stale/concurrent conflict. |
| `POST` | `/api/enrollment-requests/{requestId}/reject` | Tutor reject. |

Session/homework APIs are under `/api/classes/{classId}/sessions`, `/api/sessions/{sessionId}/...`, `/api/classes/{classId}/materials`, `/api/classes/{classId}/syllabus-file`, `/api/tutor/homework-overview`, and `/api/student/homework-overview`.

## 7. Community APIs

Community belongs to Learning Service and is exposed through `/api/community`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/community/posts` | Feed/list; supports `postType`, `status`, `subjectId`, `learningMode`, `keyword`, `followingOnly`, `page`, `size`; authenticated all-feed prioritizes followed Tutors. |
| `GET` | `/api/community/posts/{id}` | Post detail and view count. |
| `GET` | `/api/community/posts/shared/{publicShareId}` | Public post detail resolved from an opaque share UUID; hidden posts return not found. |
| `GET` | `/api/community/posts/mine` | Current user's posts. |
| `GET` | `/api/community/posts/bookmarked` | Current user's bookmarks. |
| `POST` | `/api/community/posts` | Create Student/Tutor post. |
| `PUT` | `/api/community/posts/{id}` | Update own post. |
| `DELETE` | `/api/community/posts/{id}` | Soft-delete/hide post. |
| `PATCH` | `/api/community/posts/{id}/close` | Close post/poll where allowed. |
| `POST` | `/api/community/polls/{pollId}/vote` | Toggle one poll option. |
| `PUT` | `/api/community/polls/{pollId}/votes` | Replace all selected poll options. |
| `DELETE` | `/api/community/polls/{pollId}/vote` | Clear current user's poll vote selections. |
| `GET` | `/api/community/posts/{id}/likes` | Like user list. |
| `POST` | `/api/community/posts/{id}/reactions` | Toggle LIKE. |
| `POST` | `/api/community/posts/{id}/bookmarks` | Toggle bookmark. |
| `GET` | `/api/community/posts/{id}/comments` | Comments. |
| `POST` | `/api/community/posts/{id}/comments` | Add comment/reply. |
| `GET` | `/api/community/posts/{id}/class-suggestion` | Tutor-author class suggestion from poll demand. |
| `POST` | `/api/community/posts/{id}/convert-to-class` | Tutor-author post-to-class conversion. |
| `PUT` | `/api/community/tutors/{tutorUserId}/follow` | Student follows an approved Tutor; idempotent. |
| `DELETE` | `/api/community/tutors/{tutorUserId}/follow` | Student unfollows a Tutor; idempotent. |
| `GET` | `/api/community/tutors/{tutorUserId}/follow-status` | Public follower count and current Student follow state. |
| `GET` | `/api/community/following-tutors` | Current Student's followed Tutors. |
| `GET` | `/api/community/tutors/{tutorUserId}/followers` | Role-scoped follower list for the Tutor. |

Community emits Learning WebSocket updates and RabbitMQ notification events for supported interactions/conversion. Do not document `/api/learning/community` unless gateway/client/source are changed.

## 8. Contract, Escrow and Termination APIs

Contract Service protected APIs derive identity from the cookie JWT and active role. Frontend-supplied role/user headers are not authoritative.

Core families include:

- `/api/contracts/agreements/initiate`
- `/api/contracts/agreements`
- `/api/contracts/agreements/{id}`
- `/api/contracts/agreements/{id}/sign`
- `/api/contracts/agreements/{id}/payment-submitted`
- `/api/contracts/agreements/{id}/document-view`
- `/api/contracts/agreements/{id}/document-artifact`
- `/api/contracts/agreements/{id}/document-artifact/finalize`
- `/api/contracts/agreements/{id}/document-artifact/preview`
- `/api/contracts/agreements/{id}/document-artifact/download`
- `/api/contracts/agreements/{id}/settlements`
- `/api/contracts/admin/financial-overview`
- `/api/contracts/admin/settlements`
- `/api/contracts/transactions/{id}/retry`
- dispute/evidence endpoints under `/api/contracts/disputes/**`

Termination API prefix: `/api/contracts/terminations`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/contracts/terminations` | Role-scoped termination/cancellation cases. |
| `GET` | `/api/contracts/terminations/refunds` | Role-scoped refund/financial progress; Student sees only own relevant agreement items. |
| `POST` | `/api/contracts/terminations` | Student agreement termination or Tutor whole-class cancellation with EIP-712 verification. |
| `POST` | `/api/contracts/terminations/admin` | Admin operational stop/cancel request. |
| `POST` | `/api/contracts/terminations/{id}/actions` | Party response or Admin-only approve/reject/force decision according to state. Legacy `RECOMMEND` is rejected; Staff access is read-only. |
| `POST multipart` | `/api/contracts/terminations/{id}/evidence` | Upload termination evidence. |
| `GET` | `/api/contracts/terminations/{id}/evidence/{evidenceId}/content` | Download authorized evidence. |

Funding, settlement, expiration and refunds are authoritative only after Contract ingests confirmed blockchain events.

Tutor-absence governance v1 extends the internal auto-propose payload with `learningSessionId`,
`sessionSequence`, class-level `tutorAttendanceOutcome`, immutable `finalizedAt`/`sourceEventId`,
and the real next-session snapshot. Contract persists that signal idempotently before detection.
Governance HOLD/RELEASE commands carry stable command IDs and cutoff fences; RELEASE also carries
`expectedHoldCommandId` and `releaseNotAfter`. Public termination views expose both deadlines,
probation state and `serverNow`; clients must not use the browser clock as the authority.

## 9. Notification and Human Chat APIs

Bell notification API:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications` | Notification list; supports pagination/unread/role filters. |
| `GET` | `/api/notifications/unread-count` | Unread count. |
| `PATCH` | `/api/notifications/{id}/read` | Mark one read. |
| `PATCH` | `/api/notifications/read-all` | Mark all matching notifications read. |
| `PUT` | `/api/notifications/chat-view-context` | Set active Messages context to suppress chat Bell noise. |
| WebSocket | `/ws/notifications` | Push notification-created frames. |

Human Student-Tutor chat API:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/chat/conversations` | Current user's conversations. |
| `POST` | `/api/chat/conversations/direct` | Create/reuse direct Student-Tutor conversation. |
| `GET` | `/api/chat/conversations/{id}/messages` | Paginated message history. |
| `POST` | `/api/chat/conversations/{id}/read` | Mark conversation read. |
| `POST` | `/api/chat/messages` | Send text message. |
| `POST multipart` | `/api/chat/conversations/{id}/attachments` | Send 1-5 images or exactly 1 video. |
| `POST` | `/api/chat/conversations/{id}/shared-resources` | Send `{resourceType, resourcePublicId, caption?}` as a validated structured Class/Post chat card. |
| WebSocket | `/ws/chat` | Push `NEW_MESSAGE` frames to authenticated participants. |

Chat attachments are private S3 objects with metadata/presigned URLs in API responses; WebSocket frames carry metadata, not binary files. Shared-resource messages persist only the resource type and public UUID; Learning Service remains the source of truth for current visibility and card content.

## 10. AI Matching APIs

Tutor Matching:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/ai/matching/analyze` | Gemini extracts natural-language tutor requirement hints. |
| `POST` | `/api/ai/matching/ground` | Ground hints to catalog/location IDs and clarification state. |
| `POST` | `/api/ai/matching/tutors` | Return ranked tutor matches. |

Tutor match responses may include `matchPercentage`, `matchingReasons`, `mismatchReasons`, `missingData`, `relaxedCriteria`, and `scoreBreakdown` with criteria/semantic components.

Class Matching:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/ai/classes/analyze` | Gemini extracts natural-language class-search hints. |
| `POST` | `/api/ai/classes/ground` | Ground class hints to catalog IDs and review/clarification state. |
| `POST` | `/api/ai/classes/match` | Return ranked public class matches. |

Class match responses include public class card fields plus `matchPercentage`, `matchingReasons`, `missingData`, `scoreBreakdown`, and `rankingMode`. Raw vector IDs, Qdrant payloads and raw cosine similarity are not public UI contracts.

Semantic maintenance:

- `/api/ai/semantic/collection/init`
- `/api/ai/semantic/index/sync`
- `/api/ai/semantic/index/capability`
- `/api/ai/semantic/search`
- `/api/ai/semantic/classes/collection/init`
- `/api/ai/semantic/classes/index/sync`
- `/api/ai/semantic/classes/index`

These endpoints are operational/maintenance surfaces, not normal Student marketplace APIs.

## 11. AI Chatbot API

`POST /api/ai/chat` belongs to AI Service.

Request shape at high level:

- `message` required, max 1200 chars.
- optional `conversation` list with role/content pairs.
- optional `pageContext` with current route/page type.

Response shape at high level:

- `message`
- `intent`
- `sources`
- `actions`
- `toolResult`

The chatbot may use RAG, public lookup/count, Tutor/Class matching, and authenticated Student/Tutor read-only tools. It does not use Notification Service chat tables and does not use `/ws/chat`.

Admin knowledge maintenance currently exists under `/api/ai/admin/chatbot-knowledge/reindex` and `/api/ai/admin/chatbot-knowledge/status`.

## 11A. Tutor Statistics API

`GET /api/tutor-statistics/v1?rangeDays=7|30|90` is the browser-facing Tutor dashboard contract owned by API Gateway.

- Authentication: JWT cookie/Bearer is accepted by the existing Gateway authorizer, but assigned role and `activeRole` must both be `TUTOR`.
- Identity: the caller cannot select a Tutor ID. Learning and Contract derive Tutor identity from the authenticated principal; extra identity query parameters are ignored.
- Learning source: `GET /api/tutor/statistics/source`, owned by Learning Service, provides class/session/student workload and public review aggregates.
- Income source: `GET /api/contracts/tutor/statistics/source`, owned by Contract Service, provides settlement-derived released and pending Tutor amounts. Legacy-excluded agreements are omitted.
- Partial failure: each source is returned as `SUCCESS` or `UNAVAILABLE`. An unavailable source has `data: null`; the Gateway does not substitute financial or academic zeros.
- `completedClasses` is currently `null` because the Learning class lifecycle has no authoritative `COMPLETED` state. Completed sessions remain supported.
- Responses are bounded to recent class/review/session rows; this endpoint does not return unbounded history.

The two source endpoints are implementation-facing aggregation sources and enforce the same active Tutor identity. Frontend code should call the Gateway endpoint, not join owner-service data itself.

## 12. Internal APIs

| Method | Endpoint | Owner | Caller | Security |
| --- | --- | --- | --- | --- |
| `GET` | `/api/internal/notification-reviewers` | Account | Contract | `X-Service-Token`, subject `contract-service`, scope `notification-recipients`. |
| `POST` | `/api/notifications/internal/send` | Notification | Contract | `X-Service-Token`, subject `contract-service`, scope `notification-send`. |
| `POST` | `/api/learning/internal/enrollment-requests/activate` | Learning | Contract | Internal lifecycle call. |
| `POST` | `/api/learning/internal/enrollment-requests/expire` | Learning | Contract | Internal lifecycle call. |
| `POST` | `/api/learning/internal/termination` | Learning | Contract | Internal termination/cutoff synchronization. |
| `GET` | `/api/internal/staff-duty/write-access?staffEmail=...` | Account | Learning/Contract | Service JWT, scope `staff-duty-check`; fail closed. |

These are not frontend/public APIs. Document service-token or internal caller expectations whenever adding similar routes.

## 13. WebSocket APIs

- `/ws/account`
- `/ws/learning`
- `/ws/notifications`
- `/ws/chat`

REST/database state remains authoritative; WebSocket events are for realtime hints and UI reconciliation.

## 14. API Status Rule

Use precise status language:

- Controller + route + service + persistence/security + client/test evidence can support `IMPLEMENTED`.
- A service method without a controller is not a public API.
- UI mock code is not proof of backend API implementation.
- Planned target capabilities should not be documented as current APIs.
