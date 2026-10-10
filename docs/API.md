# EduConnect API Baseline

> Post-merge baseline: 2026-10-10. This file documents current API families verified from merged controllers and frontend clients. It is not a full OpenAPI dump.

## 1. API Principles

- Each service owns APIs for its domain.
- Browser clients use credentialed requests, HttpOnly cookies and CSRF for state-changing calls.
- Frontend/Mobile must not access databases directly.
- Internal service endpoints must be treated as service-token protected even when the Spring route itself is not a normal user-facing route.
- Do not document a standalone `/matching` product route. AI Matching is part of Tutor Marketplace, Class Marketplace and chatbot flows.

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

Tutor/account related APIs include `/api/tutors`, `/api/tutors/search-v2`, `/api/tutors/{tutorProfileId}/detail-v2`, `/api/tutor-applications/**`, `/api/staff/tutor-applications/**`, `/api/staff/tutors/**`, and admin user management under `/api/admin/users`, `/api/users/admin`, `/api/staff/users`.

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
| `POST` | `/api/classes/{classId}/enroll` | Student enroll/request join. |
| `GET` | `/api/student/classes` | Student classes. |
| `GET` | `/api/student/schedule` | Student schedule. |
| `GET` | `/api/enrollment-requests/my-requests` | Student request list. |
| `POST` | `/api/enrollment-requests/{requestId}/cancel` | Cancel request. |
| `POST` | `/api/enrollment-requests/{requestId}/accept` | Tutor accept. |
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
| `POST` | `/api/contracts/terminations/{id}/actions` | Respond/recommend/approve/reject/force action according to role and state. |
| `POST multipart` | `/api/contracts/terminations/{id}/evidence` | Upload termination evidence. |
| `GET` | `/api/contracts/terminations/{id}/evidence/{evidenceId}/content` | Download authorized evidence. |

Funding, settlement, expiration and refunds are authoritative only after Contract ingests confirmed blockchain events.

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

## 12. Internal APIs

| Method | Endpoint | Owner | Caller | Security |
| --- | --- | --- | --- | --- |
| `GET` | `/api/internal/notification-reviewers` | Account | Contract | `X-Service-Token`, subject `contract-service`, scope `notification-recipients`. |
| `POST` | `/api/notifications/internal/send` | Notification | Contract | `X-Service-Token`, subject `contract-service`, scope `notification-send`. |
| `POST` | `/api/learning/internal/enrollment-requests/activate` | Learning | Contract | Internal lifecycle call. |
| `POST` | `/api/learning/internal/enrollment-requests/expire` | Learning | Contract | Internal lifecycle call. |
| `POST` | `/api/learning/internal/termination` | Learning | Contract | Internal termination/cutoff synchronization. |

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
