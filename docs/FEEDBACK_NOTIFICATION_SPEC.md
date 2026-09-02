# EduConnect Feedback, Notification, and Realtime Living Spec

This file is the living architecture specification for local UI feedback, persistent notifications, Bell notification center behavior, RabbitMQ business events, WebSocket realtime delivery, and frontend cache invalidation.

It is intended for developers and AI agents before implementing features that write data, change business status, affect another user, require realtime behavior, or produce financial/security state.

Entries marked `PLANNED` are architectural requirements for future implementation only. Do not implement them unless the requested task explicitly includes that feature.

## 1. Scope

This spec covers:

- Local UI feedback.
- Global toast.
- Confirm modal.
- Important success modal.
- Persistent notification.
- Bell notification center.
- RabbitMQ notification events.
- WebSocket realtime delivery.
- TanStack Query invalidation.
- Current and future event behavior.

This spec is documentation only. Current source includes a backend Notification Service foundation, frontend Bell integration, and limited notification WebSocket delivery. Entries marked `PLANNED` remain future requirements only.

## 2. Status Model

| Status | Meaning |
| --- | --- |
| `IMPLEMENTED` | The real business feature is implemented with enough source evidence for its main flow. |
| `PARTIAL` | Part of the feature exists, but notification, realtime, API, UI, or end-to-end behavior is incomplete. |
| `PLANNED` | The business direction is confirmed, but code is not implemented yet. This is not permission to implement out of scope. |
| `NOT_REQUIRED` | Persistent notification or realtime behavior is intentionally not required for this action. |
| `DEPRECATED` | Legacy behavior exists but must not be used for new feature work. |

## 3. Core Architecture Rule

| Layer | Responsibility |
| --- | --- |
| REST | Primary read/write business API and source of normal request responses. |
| TanStack Query | Frontend server-state cache where useful. It is not the auth source of truth. |
| Global Feedback | Local action feedback for the current user and current browser session. |
| RabbitMQ | Cross-service business events. |
| Notification Service | Persistent user notifications stored by recipient User account and exposed through REST. Current backend foundation is partial. |
| WebSocket | Realtime event delivery to online clients. |
| Bell | Notification center UI for unread and historical persistent notifications. |

Do not replace REST with WebSocket. WebSocket is delivery, not source of truth.

## 4. Current Foundation Snapshot

| Area | Current Source | Status | Notes |
| --- | --- | --- | --- |
| Global feedback provider | `frontend-web/src/components/feedback/FeedbackProvider.jsx` | `IMPLEMENTED` | Provides toast, confirm, and important success modal APIs. |
| Toast viewport | `frontend-web/src/components/feedback/ToastViewport.jsx` | `IMPLEMENTED` | Shows up to four global toasts. |
| Confirm modal | `frontend-web/src/components/feedback/ConfirmModal.jsx` | `IMPLEMENTED` | Promise-style confirmation with default/destructive variants. |
| Important success modal | `frontend-web/src/components/feedback/ImportantSuccessModal.jsx` | `IMPLEMENTED` | Used for important acknowledgement-style success states such as password change. |
| Feedback hook | `frontend-web/src/components/feedback/useFeedback.js` | `IMPLEMENTED` | Re-export of `useFeedback` from the provider. |
| Feedback types | `frontend-web/src/components/feedback/feedbackTypes.js` | `IMPLEMENTED` | Defines `success`, `error`, `warning`, `info`, and confirm variants. |
| Realtime provider | `frontend-web/src/realtime/RealtimeProvider.jsx` | `PARTIAL` | Connects to `/ws/account`, `/ws/learning`, and `/ws/notifications`; dispatches `realtime:event`, shows global toasts, invalidates notification queries, and syncs TutorApplication review state. |
| Realtime refresh hook | `frontend-web/src/realtime/useRealtimeRefresh.js` | `PARTIAL` | Local browser event bridge for screens that need refresh. |
| Student Bell | `frontend-web/src/components/home/HomeHeader.jsx` | `IMPLEMENTED` | Uses shared REST Bell dropdown with real unread count, latest notifications, read state, mark-one-read, and mark-all-read. |
| Portal Bell | `frontend-web/src/portal/components/Header.tsx` | `IMPLEMENTED` | Uses shared REST Bell dropdown for Tutor/Staff/Admin with the same account-wide notification source. |
| Notification service | `backend/notification-service` | `PARTIAL` | Backend persistence, REST read/unread API, JWT-cookie security, RabbitMQ consumers, event idempotency, and raw WebSocket delivery exist for a limited event slice. |
| TutorApplication cache | `frontend-web/src/hooks/useTutorApplication.js` | `IMPLEMENTED` | TanStack Query key `["tutorApplication", "me"]`. |

Future frontend code must not create browser `alert()`, browser `confirm()`, or arbitrary local toast systems for normal action feedback. Use `useFeedback()` unless a business-input modal is required.

Known legacy exception: `frontend-web/src/portal/components/MessagesView.tsx` still contains browser `alert()` calls in a mock/legacy messaging UI. Do not copy that pattern.

## 5. Local Feedback Classification

| Classification | Confirmation | Success UI | Error UI | Persistent Notification | Realtime |
| --- | --- | --- | --- | --- | --- |
| `NORMAL_WRITE` | No | Success toast | Error toast | No by default | No by default |
| `IMPORTANT_WRITE` | Optional when acknowledgement matters | Toast or Important Success Modal | Error toast | Only if user may need to revisit later | Optional |
| `DESTRUCTIVE_WRITE` | Confirm before action | Success toast | Error toast | Only if another user is affected or state matters offline | Optional |
| `SECURITY_SENSITIVE` | Optional depending on risk | Toast or Important Success Modal | Error toast | Usually no, unless account/security state needs revisit | No by default |
| `FINANCIAL_CRITICAL` | Confirm before action | Transaction/progress UI and Important Success Modal | Error toast or blocking error state | Yes when authoritative state changes | Yes when time-sensitive |
| `FIELD_VALIDATION` | No | Inline only if needed | Inline validation | No | No |

## 6. Persistent Notification Rule

Persistent notification is not created for every write operation.

Create a persistent Notification when:

- another user is affected;
- business state changed in a way the recipient needs to revisit;
- an important approval/result is produced;
- transaction/payment state changes authoritatively;
- a message/request requires attention;
- the recipient may be offline.

Do not create Bell notifications for:

- profile update;
- avatar upload;
- field validation;
- role switch;
- search/filter;
- normal self-edit actions.

## 7. Realtime Rule

Use WebSocket when:

- the recipient should know promptly while online;
- the event is cross-user or time-sensitive;
- realtime UI refresh materially improves the workflow.

Do not use WebSocket for:

- normal CRUD that only affects the current user;
- profile updates;
- form validation;
- searches;
- static reference data.

WebSocket payloads must be small. The authoritative state remains REST/backend state or Notification DB state.

## 8. Notification Ownership Model

Notification belongs to the User account, not to a separate role inbox.

Target Notification fields should support:

- `recipientUserId`;
- optional `targetRole` or context;
- `referenceType`;
- `referenceId`.

A single User may have both `STUDENT` and `TUTOR` roles. The UI can filter or route notifications by active role/context, but the backend must authorize notification ownership server-side.

## 9. Target Bell Requirements

| Requirement | Status | Notes |
| --- | --- | --- |
| Real unread count | `IMPLEMENTED` | Bell reads `/api/notifications/unread-count` through TanStack Query. |
| Latest notification dropdown | `IMPLEMENTED` | Bell reads `/api/notifications?page=0&size=8` through TanStack Query. |
| Read/unread visual state | `IMPLEMENTED` | Bell renders backend `read` state. |
| Timestamp | `IMPLEMENTED` | Bell renders backend `createdAt` with compact relative formatting. |
| Mark one read | `IMPLEMENTED` | Bell calls `PATCH /api/notifications/{id}/read` and invalidates notification queries. |
| Mark all read | `IMPLEMENTED` | Bell calls `PATCH /api/notifications/read-all` and invalidates notification queries. |
| Click notification | `PARTIAL` | Bell routes only to existing known targets. Unknown notification targets do not navigate. |
| Realtime insert while online | `PARTIAL` | `/ws/notifications` sends `NOTIFICATION_CREATED`; frontend invalidates notification queries and refetches through REST instead of treating the socket payload as authoritative state. |
| REST refetch on reconnect/focus | `IMPLEMENTED` | Notification queries refetch on window focus, and notification WebSocket reconnect invalidates notification queries for REST reconciliation. |
| Empty state | `IMPLEMENTED` | Shared Bell dropdown shows an empty state when the backend returns no notifications. |

## 10. Notification Entity

The current backend implements the minimum persistent notification model in `backend/notification-service`.

| Field | Purpose |
| --- | --- |
| `id` | Notification row identity. |
| `eventId` | Idempotency and deduplication key. Must be unique for a business event. |
| `recipientUserId` | User account that owns the notification. |
| `targetRole` | Optional role/context hint such as `STUDENT`, `TUTOR`, `STAFF`, or `ADMIN`. |
| `type` | Business notification type. |
| `title` | Short display title. |
| `message` | Human-readable summary without sensitive payload. |
| `referenceType` | Domain object type such as tutor application, class, contract, or message. |
| `referenceId` | Domain object id or stable reference. |
| `readAt` / `isRead` | Read state. Prefer `readAt` for auditability. |
| `createdAt` | Server timestamp. |

Sensitive fields such as CCCD/passport numbers, document URLs, private evidence, JWTs, wallet private keys, and full contract text must never be put into notification payloads.

Current notification WebSocket envelope:

| Field | Meaning |
| --- | --- |
| `source` | Event source, currently `notification-service`. |
| `eventType` | Delivery envelope type, currently `NOTIFICATION_CREATED`. |
| `notificationId` | Persisted notification id. |
| `notificationType` | Business notification type such as `TUTOR_APPLICATION_REVIEWED`. |
| `recipientUserId` | Authenticated recipient account id. |
| `targetRole` | Optional role/context hint. |
| `referenceType` | Referenced domain type. |
| `referenceId` | Referenced domain id. |
| `title` | Display title. |
| `message` | Display message without sensitive payload. |
| `createdAt` | Server creation timestamp. |

## 11. Existing Event Catalog

These are event names verified in current source.

| Event | Feature Status | Producer | Recipient | Local Feedback | Persistent Notification | Realtime | Bell | Click Target | Implementation Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TUTOR_APPLICATION_SUBMITTED` | `IMPLEMENTED` | Account Service | Staff/Admin reviewers | Submitter gets toast in FE flow | `PLANNED` | `IMPLEMENTED` through `/ws/account` reviewers | `PLANNED` | `/staff/tutors` | Durable Rabbit event exists, but reviewer recipient ids are not available in the payload, so Notification Service skips persistent creation. |
| `TUTOR_APPLICATION_REVIEWED` | `IMPLEMENTED` | Account Service | Applicant and Staff/Admin reviewers | Reviewer gets action feedback | `PARTIAL` | `IMPLEMENTED` through `/ws/account`; persisted applicant notifications also deliver through `/ws/notifications` | `IMPLEMENTED` | `/profile`, `/tutor-next-step`, or `/staff/tutors` depending context | Notification Service consumes durable approved/rejected events, creates applicant notifications, emits `NOTIFICATION_CREATED`, and frontend invalidates Bell plus `["tutorApplication","me"]` and refreshes auth user. |
| `TEACHING_REGISTRATION_SUBMITTED` | `IMPLEMENTED` | Learning Service | Staff/Admin reviewers | Submitter gets toast in FE flow | `PLANNED` | `IMPLEMENTED` through `/ws/learning` reviewers | `PLANNED` | `/staff/tutors` | Business submit and realtime exist; notification DB/Bell missing. |
| `TEACHING_REGISTRATION_REVIEWED` | `IMPLEMENTED` | Learning Service | Tutor and Staff/Admin reviewers | Reviewer gets action feedback | `PLANNED` | `IMPLEMENTED` through `/ws/learning` broadcast plus FE filtering | `PLANNED` | `/tutor/teaching-registrations` or `/staff/tutors` | Business review and realtime exist; notification DB/Bell missing. |
| `SUBJECT_REQUEST_SUBMITTED` | `IMPLEMENTED` | Learning Service | Admin reviewers | Submitter gets toast in FE flow | `PLANNED` | `IMPLEMENTED` through `/ws/learning` reviewers | `PLANNED` | `/staff/tutors` | Subject proposal submit realtime exists, but no durable notification event with reviewer recipients is implemented. |
| `SUBJECT_REQUEST_REVIEWED` | `IMPLEMENTED` | Learning Service | Requesting user and reviewers | Reviewer gets action feedback | `PARTIAL` | `IMPLEMENTED` through `/ws/learning`; persisted requester notifications also deliver through `/ws/notifications` | `IMPLEMENTED` | `/tutor/teaching-registrations` or `/staff/tutors` | Notification Service consumes durable approved/rejected events, creates requester notifications, emits `NOTIFICATION_CREATED`, and frontend invalidates Bell queries. |
| `CLASS_SUBMITTED` | `IMPLEMENTED` | Learning Service | Staff/Admin reviewers | Tutor gets toast in FE flow | `PLANNED` | `IMPLEMENTED` through `/ws/learning` reviewers | `PLANNED` | `/staff/tutors` | Class submit and realtime exist; notification DB/Bell missing. |
| `CLASS_REVIEWED` | `IMPLEMENTED` | Learning Service | Tutor and Staff/Admin reviewers | Reviewer gets action feedback | `PLANNED` | `IMPLEMENTED` through `/ws/learning` broadcast plus FE filtering | `PLANNED` | `/dashboard` or `/staff/tutors` | Class review and realtime exist; notification DB/Bell missing. |

## 12. Recommended Event Catalog

These are target events derived from current project scope and docs. They are not implemented unless noted.

| Event | Feature Status | Producer | Recipient | Local Feedback | Persistent Notification | Realtime | Bell | Click Target | Implementation Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ENROLLMENT_REQUESTED` | `IMPLEMENTED` | Learning Service | Tutor | Student toast | Yes | Yes through Notification Service WebSocket | Yes | `/dashboard` | Student request emits Rabbit event, Notification Service persists Tutor notification, and frontend refreshes Tutor request state through `realtime:event`. |
| `ENROLLMENT_ACCEPTED` | `IMPLEMENTED` | Learning Service | Student | Tutor toast | Yes | Yes through Notification Service WebSocket | Yes | `/my-classes` | Tutor accept emits Rabbit event, Notification Service persists Student notification, and frontend refreshes Student request state through `realtime:event`. |
| `ENROLLMENT_REJECTED` | `IMPLEMENTED` | Learning Service | Student | Tutor toast | Yes | Yes through Notification Service WebSocket | Yes | `/my-classes` | Tutor reject and auto-reject on full class emit Rabbit events, Notification Service persists Student notification, and frontend refreshes Student request state. |
| `ENROLLMENT_CANCELLED` | `IMPLEMENTED` | Learning Service | Tutor | Student toast | Yes | Yes through Notification Service WebSocket | Yes | `/dashboard` | Student cancel is meaningful because the Tutor pending queue changes, so Tutor receives a persistent notification and realtime refresh. |
| `SESSION_CREATED` | `PLANNED` | Learning Service | Student | Tutor toast | Yes | Recommended | Yes | `TBD / FUTURE ROUTE` | Session feature not implemented. |
| `SESSION_UPDATED` | `PLANNED` | Learning Service | Student/Tutor | Toast | Yes when schedule-impacting | Recommended | Yes when schedule-impacting | `TBD / FUTURE ROUTE` | Session feature not implemented. |
| `SESSION_CANCELLED` | `PLANNED` | Learning Service | Student/Tutor | Confirm before cancel, then toast | Yes | Required | Yes | `TBD / FUTURE ROUTE` | Session feature not implemented. |
| `ATTENDANCE_RECORDED` | `PLANNED` | Learning Service | Student/Tutor | Toast | Persistent only when correction/dispute-relevant | Recommended | Optional | `TBD / FUTURE ROUTE` | Attendance feature not implemented. |
| `HOMEWORK_CREATED` | `PLANNED` | Learning Service | Student | Tutor toast | Yes | Recommended | Yes | `TBD / FUTURE ROUTE` | Homework feature not implemented. |
| `HOMEWORK_UPDATED` | `PLANNED` | Learning Service | Student | Tutor toast | Yes when due date/content changes materially | Recommended | Yes when material | `TBD / FUTURE ROUTE` | Homework feature not implemented. |
| `HOMEWORK_SUBMITTED` | `PLANNED` | Learning Service | Tutor | Student toast | Yes | Recommended | Yes | `TBD / FUTURE ROUTE` | Homework submission not implemented. |
| `HOMEWORK_GRADED` | `PLANNED` | Learning Service | Student | Tutor toast | Yes | Recommended | Yes | `TBD / FUTURE ROUTE` | Homework grading not implemented. |
| `CONTRACT_CREATED` | `PARTIAL` | Contract Service | Student/Tutor | Toast | Yes | Recommended | Yes | `/contracts` | Contract workflow partial; public REST flow missing. |
| `CONTRACT_SIGNED` | `PARTIAL` | Contract Service | Counterparty | Important success for signer | Yes | Required | Yes | `/contracts` | Contract workflow partial; public REST flow missing. |
| `CONTRACT_ACTIVATED` | `PARTIAL` | Contract Service | Student/Tutor | Important success | Yes | Required | Yes | `/contracts` | Contract workflow partial; public REST flow missing. |
| `ESCROW_FUNDED` | `PARTIAL` | Contract Service | Student/Tutor | Financial progress and Important Success Modal | Yes | Required after authoritative confirmation | Yes | `/payments` or `/contracts` | Escrow/Web3 partial; REST integration incomplete. |
| `SESSION_SETTLED` | `PLANNED` | Contract Service | Student/Tutor | Financial progress and Important Success Modal | Yes | Required after authoritative confirmation | Yes | `/payments` or `/contracts` | End-to-end learning-to-contract settlement missing. |
| `PAYMENT_CONFIRMED` | `PARTIAL` | Contract Service | Student/Tutor/Admin as applicable | Financial progress and Important Success Modal | Yes | Required after authoritative confirmation | Yes | `/payments` | Payment flow partial. |
| `REFUND_PROCESSED` | `PARTIAL` | Contract Service | Student/Tutor/Admin as applicable | Important Success Modal | Yes | Required after authoritative confirmation | Yes | `/payments` or `/contracts` | Refund workflow partial. |
| `DISPUTE_OPENED` | `PARTIAL` | Contract Service | Counterparty/Staff/Admin | Confirm before submit, then toast | Yes | Required | Yes | `/contracts` | Dispute workflow partial. |
| `DISPUTE_RESOLVED` | `PARTIAL` | Contract Service | Student/Tutor/Admin as applicable | Important Success Modal for resolver | Yes | Required | Yes | `/contracts` | Dispute workflow partial. |
| `MESSAGE_RECEIVED` | `PLANNED` | Messaging domain owner TBD | Recipient | Sender local send state | Yes, preferably summary only | Required | Yes, summary only | `/messages` | Messaging backend/API missing; web UI is mock/partial. |
| `COMPLAINT_CREATED` | `PLANNED` | Complaint/support domain owner TBD | Staff/Admin or counterparty as applicable | Confirm when sensitive, then toast | Yes | Recommended | Yes | `TBD / FUTURE ROUTE` | Complaint/support module not implemented. |
| `COMPLAINT_RESOLVED` | `PLANNED` | Complaint/support domain owner TBD | Reporter and affected users | Important success when current user resolves | Yes | Recommended | Yes | `TBD / FUTURE ROUTE` | Complaint/support module not implemented. |
| `MATCHING_READY` | `PLANNED` | AI Matching domain owner TBD | Student/Tutor depending matching flow | Toast only when generated from explicit action | Optional | Recommended only for long-running jobs | Optional | `/matching` | AI Matching service not implemented. |

## 13. Current Implemented Feature Matrix

| Module | Feature | Feature Status | Notification/Realtime Status |
| --- | --- | --- | --- |
| Account | Register | `IMPLEMENTED` | Local feedback only. |
| Account | Verify email | `IMPLEMENTED` | Local feedback only. |
| Account | Reset password | `IMPLEMENTED` | Local feedback only. |
| Account | Update profile | `IMPLEMENTED` | Local feedback only; no Bell notification required. |
| Account | Avatar upload | `IMPLEMENTED` | Local feedback only; no Bell notification required. |
| Account | Change password | `IMPLEMENTED` | Important success modal is implemented; persistent notification not required by default. |
| Account | Role activation/switch | `IMPLEMENTED` | Local feedback/navigation only; no Bell notification required. |
| Tutor | Tutor application create/update/submit | `IMPLEMENTED` | Submission has realtime reviewer event; persistent notification planned. |
| Tutor | Tutor document upload/delete | `IMPLEMENTED` | Local feedback; query invalidation where TutorApplication completeness/status can change. |
| Tutor | Staff tutor review | `IMPLEMENTED` | Realtime applicant/reviewer event exists; persistent applicant notification exists for durable approved/rejected Rabbit events; Bell REST UI is implemented. |
| Teaching | Teaching registration submit/review | `IMPLEMENTED` | Realtime events exist; persistent notification planned. |
| Teaching | Subject proposal/review | `IMPLEMENTED` | Realtime events exist; RabbitMQ decision integration creates requester notifications for approved/rejected subject requests; Bell REST UI is implemented. |
| Class | Create/update/delete/visibility | `PARTIAL` | Create/review realtime exists; local self-edits need local feedback only unless another user is affected. |
| Class | Staff approve/reject | `IMPLEMENTED` | Realtime event exists; persistent notification planned. |
| Enrollment | Request/accept/reject/cancel | `IMPLEMENTED` | REST APIs, RabbitMQ notification events, persistent notifications, Bell realtime delivery, and targeted frontend state refresh exist for request/accept/reject/cancel. |
| Admin | User status | `IMPLEMENTED` | Local feedback; persistent notification optional only if user-facing account status notification is required. |
| Admin | Catalog management | `IMPLEMENTED` | Local feedback only; no Bell notification required for normal catalog CRUD. |
| Contract/Web3 | Contract/payment/escrow/dispute | `PARTIAL` | Use financial rules. Notification/realtime should wait for authoritative backend confirmation. |
| Messaging | Messages | `PARTIAL` | Web mock/local UI exists; backend persistence/API/realtime are planned. |
| Notification | Persistent notifications and Bell center | `PARTIAL` | Backend Notification Service has persistence, REST list/unread/read APIs, JWT-cookie ownership checks, a limited Rabbit consumer slice, raw WebSocket delivery for persisted notification creation, and frontend Bell cache synchronization. |
| AI Matching | Matching/recommendations | `PLANNED` | AI service not implemented. |

## 14. Feedback Matrix

| Module | Action | Feature Status | Classification | Confirmation | Success UI | Error UI | Persistent Notification | Realtime |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Account | Register | `IMPLEMENTED` | `NORMAL_WRITE` | No | Toast or route success state | Toast/inline | No | No |
| Account | Verify email | `IMPLEMENTED` | `SECURITY_SENSITIVE` | No | Toast or Important Success Modal | Toast/inline | No by default | No |
| Account | Reset password | `IMPLEMENTED` | `SECURITY_SENSITIVE` | No | Toast or Important Success Modal | Toast/inline | No by default | No |
| Account | Update profile | `IMPLEMENTED` | `NORMAL_WRITE` | No | Toast | Toast/inline | No | No |
| Account | Upload avatar | `IMPLEMENTED` | `NORMAL_WRITE` | No | Toast | Toast | No | No |
| Account | Change password | `IMPLEMENTED` | `SECURITY_SENSITIVE` | No | Important Success Modal | Toast/inline | No by default | No |
| Account | Switch role | `IMPLEMENTED` | `NORMAL_WRITE` | No | Toast/navigation | Toast | No | No |
| Tutor | Create TutorApplication | `IMPLEMENTED` | `IMPORTANT_WRITE` | No | Toast and profile section update | Toast | No until submitted | No |
| Tutor | Submit TutorApplication | `IMPLEMENTED` | `IMPORTANT_WRITE` | Optional if UX needs acknowledgement | Toast | Toast/inline missing-items | Yes for reviewers | Yes |
| Tutor | Staff approve/reject TutorApplication | `IMPLEMENTED` | `IMPORTANT_WRITE` | Reject requires reason input | Toast | Toast/inline | Yes for applicant | Yes |
| Tutor | Upload/delete tutor document | `IMPLEMENTED` | `NORMAL_WRITE` / `DESTRUCTIVE_WRITE` for delete | Delete confirm | Toast | Toast | No by default | No |
| Teaching | Submit teaching registration | `IMPLEMENTED` | `IMPORTANT_WRITE` | Optional | Toast | Toast/inline | Yes for reviewers | Yes |
| Teaching | Review teaching registration | `IMPLEMENTED` | `IMPORTANT_WRITE` | Reject requires reason input | Toast | Toast/inline | Yes for Tutor | Yes |
| Teaching | Submit subject request | `IMPLEMENTED` | `IMPORTANT_WRITE` | Optional | Toast | Toast/inline | Yes for Admin | Yes |
| Teaching | Review subject request | `IMPLEMENTED` | `IMPORTANT_WRITE` | Reject requires reason input | Toast | Toast/inline | Yes for requester | Yes |
| Class | Create class for review | `IMPLEMENTED` | `IMPORTANT_WRITE` | Optional | Toast | Toast/inline | Yes for reviewers | Yes |
| Class | Update own class details/visibility | `IMPLEMENTED` | `NORMAL_WRITE` | No | Toast | Toast/inline | No by default | No by default |
| Class | Delete draft/rejected/pending class | `IMPLEMENTED` | `DESTRUCTIVE_WRITE` | Yes | Toast | Toast | No by default | No by default |
| Class | Staff approve/reject class | `IMPLEMENTED` | `IMPORTANT_WRITE` | Reject requires reason input | Toast | Toast/inline | Yes for Tutor | Yes |
| Enrollment | Student sends request | `IMPLEMENTED` | `IMPORTANT_WRITE` | Optional | Toast | Toast/inline | Yes for Tutor | Recommended |
| Enrollment | Student cancels request | `IMPLEMENTED` | `DESTRUCTIVE_WRITE` | Yes | Toast | Toast | Yes for Tutor | Recommended |
| Enrollment | Tutor accepts/rejects request | `IMPLEMENTED` | `IMPORTANT_WRITE` | Reject requires reason input | Toast | Toast/inline | Yes for Student | Recommended |
| Admin | Lock/unlock user | `IMPLEMENTED` | `SECURITY_SENSITIVE` | Yes recommended | Toast | Toast | Optional if notifying affected user is required | Recommended only if user is online |
| Admin | Catalog CRUD | `IMPLEMENTED` | `NORMAL_WRITE` | Destructive/status changes may confirm | Toast | Toast/inline | No by default | No |
| Contract | Sign contract | `PARTIAL` | `FINANCIAL_CRITICAL` when tied to payment | Yes | Important Success Modal after authoritative state | Blocking error/toast | Yes | Required when implemented |
| Payment | Fund escrow | `PARTIAL` | `FINANCIAL_CRITICAL` | Yes | Progress UI, then Important Success Modal after confirmation | Blocking error/toast | Yes after confirmation | Required after confirmation |
| Messaging | Send message | `PLANNED` | `NORMAL_WRITE` | No | Local send state | Inline/toast | Yes for recipient summary | Required |
| AI Matching | Generate matching | `PLANNED` | `IMPORTANT_WRITE` for long-running generation | Optional | Toast or result-ready state | Toast/inline | Optional | Recommended only for long-running jobs |

## 15. Notification Event Matrix

| Event | Status | Producer | Recipient | Notification | Realtime | Target Role | Click Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `TUTOR_APPLICATION_SUBMITTED` | `PARTIAL` | Account Service | Staff/Admin | Planned persistent notification; current durable payload lacks reviewer recipient ids | Implemented | `STAFF`/`ADMIN` | `/staff/tutors` |
| `TUTOR_APPLICATION_REVIEWED` | `PARTIAL` | Account Service | Applicant | Backend persistent notification and Bell REST UI implemented for approved/rejected events | Implemented through account realtime and notification WebSocket | `TUTOR` or account context | `/profile` or `/tutor-next-step` |
| `TEACHING_REGISTRATION_SUBMITTED` | `PARTIAL` | Learning Service | Staff/Admin | Planned persistent notification | Implemented | `STAFF`/`ADMIN` | `/staff/tutors` |
| `TEACHING_REGISTRATION_REVIEWED` | `PARTIAL` | Learning Service | Tutor | Planned persistent notification | Implemented | `TUTOR` | `/tutor/teaching-registrations` |
| `SUBJECT_REQUEST_SUBMITTED` | `PARTIAL` | Learning Service | Admin | Planned persistent notification; no durable reviewer-recipient event yet | Implemented | `ADMIN` | `/staff/tutors` |
| `SUBJECT_REQUEST_REVIEWED` | `PARTIAL` | Learning Service | Requester | Backend persistent notification and Bell REST UI implemented for approved/rejected events | Implemented through learning realtime and notification WebSocket | `TUTOR` | `/tutor/teaching-registrations` |
| `CLASS_SUBMITTED` | `PARTIAL` | Learning Service | Staff/Admin | Planned persistent notification | Implemented | `STAFF`/`ADMIN` | `/staff/tutors` |
| `CLASS_REVIEWED` | `PARTIAL` | Learning Service | Tutor | Planned persistent notification | Implemented | `TUTOR` | `/dashboard` |
| `ENROLLMENT_REQUESTED` | `IMPLEMENTED` | Learning Service | Tutor | Persistent notification implemented | Implemented through Notification Service WebSocket | `TUTOR` | `/dashboard` |
| `ENROLLMENT_ACCEPTED` | `IMPLEMENTED` | Learning Service | Student | Persistent notification implemented | Implemented through Notification Service WebSocket | `STUDENT` | `/my-classes` |
| `ENROLLMENT_REJECTED` | `IMPLEMENTED` | Learning Service | Student | Persistent notification implemented | Implemented through Notification Service WebSocket | `STUDENT` | `/my-classes` |
| `ENROLLMENT_CANCELLED` | `IMPLEMENTED` | Learning Service | Tutor | Persistent notification implemented | Implemented through Notification Service WebSocket | `TUTOR` | `/dashboard` |
| `MESSAGE_RECEIVED` | `PLANNED` | Messaging domain owner TBD | Recipient | Summary notification only | Required | Active role/context if known | `/messages` |
| `ESCROW_FUNDED` | `PLANNED` | Contract Service | Student/Tutor | Required after confirmation | Required | `STUDENT`/`TUTOR` | `/payments` or `/contracts` |
| `DISPUTE_RESOLVED` | `PLANNED` | Contract Service | Student/Tutor/Admin | Required | Required | Context-specific | `/contracts` |

## 16. WebSocket Matrix

### REALTIME_REQUIRED

| Event/Area | Status | Reason |
| --- | --- | --- |
| `TUTOR_APPLICATION_REVIEWED` | `IMPLEMENTED` | Applicant should see approval/rejection promptly; `/ws/notifications` also syncs Bell and TutorApplication cache for persisted applicant notifications. |
| `CLASS_REVIEWED` | `IMPLEMENTED` | Tutor should see class approval/rejection promptly. |
| `CONTRACT_SIGNED` | `PLANNED` | Counterparty should know promptly once implemented. |
| `ESCROW_FUNDED` | `PLANNED` | Financial state should update promptly after authoritative confirmation. |
| `SESSION_CANCELLED` | `PLANNED` | Schedule impact is time-sensitive. |
| `MESSAGE_RECEIVED` | `PLANNED` | Messaging requires online delivery. |

### REALTIME_RECOMMENDED

| Event/Area | Status | Reason |
| --- | --- | --- |
| `TUTOR_APPLICATION_SUBMITTED` | `IMPLEMENTED` | Staff queue refresh benefits from realtime. |
| `TEACHING_REGISTRATION_SUBMITTED` | `IMPLEMENTED` | Review queue refresh benefits from realtime. |
| `TEACHING_REGISTRATION_REVIEWED` | `IMPLEMENTED` | Tutor status can refresh promptly. |
| `SUBJECT_REQUEST_SUBMITTED` | `IMPLEMENTED` | Admin review queue refresh benefits from realtime. |
| `SUBJECT_REQUEST_REVIEWED` | `IMPLEMENTED` | Requester can update proposal state promptly; `/ws/notifications` also syncs Bell for persisted requester notifications. |
| `CLASS_SUBMITTED` | `IMPLEMENTED` | Staff queue refresh benefits from realtime. |
| Enrollment request/create/accept/reject/cancel | `IMPLEMENTED` | Student/Tutor request state benefits from prompt updates; Notification WebSocket and frontend `realtime:event` refresh are implemented for the current enrollment flow. |
| Homework assignment/submission/grading | `PLANNED` | Learning workflow benefits from prompt updates. |

### PERSISTENT_ONLY

| Event/Area | Status | Reason |
| --- | --- | --- |
| Account security audit notice | `PLANNED` | User may need to revisit, but not necessarily realtime. |
| Non-urgent catalog/admin notices | `PLANNED` | Offline durability matters more than realtime. |

### LOCAL_FEEDBACK_ONLY

| Action | Status | Reason |
| --- | --- | --- |
| Update own profile | `IMPLEMENTED` | Self-edit, no cross-user attention required. |
| Upload avatar | `IMPLEMENTED` | Self-edit, no cross-user attention required. |
| Change filters/search | `IMPLEMENTED` | Read-only local UI behavior. |
| Switch active role | `IMPLEMENTED` | Context/navigation change, no Bell notification. |
| Normal catalog CRUD | `IMPLEMENTED` | Admin self-action unless separately productized as announcement. |

### NO_NOTIFICATION

| Action | Status | Reason |
| --- | --- | --- |
| Field validation | `IMPLEMENTED` | Inline only. |
| Open/close dropdown/modal | `IMPLEMENTED` | Pure UI state. |
| Typing in search/filter input | `IMPLEMENTED` | Pure UI state. |
| WebSocket reconnect attempt | `IMPLEMENTED` | Technical event; should not spam users. |

## 17. TanStack Query Integration Rules

Current implemented query:

```js
["tutorApplication", "me"]
```

Defined in `frontend-web/src/hooks/useTutorApplication.js`.

Current notification query keys are defined in `frontend-web/src/hooks/useNotifications.js` and power the shared Bell list/unread count.

Rules:

- Keep query keys centralized in small hook/key modules.
- WebSocket event should invalidate affected query keys and then refetch authoritative REST state.
- `NOTIFICATION_CREATED` from `/ws/notifications` invalidates `notificationKeys.all`.
- `TUTOR_APPLICATION_REVIEWED` or `referenceType=TUTOR_APPLICATION` invalidates `tutorApplicationKeys.mine()` and refreshes AuthContext user so approval-dependent UI updates without reload.
- Prefer invalidation/refetch over manually pushing large server-state payloads into frontend cache.
- `AuthContext` remains responsible for logged-in user, roles, active role, switch role, logout, and refresh user.
- Do not merge AuthContext into TanStack Query in this spec.
- Do not migrate all frontend APIs to TanStack Query just because it exists.

Future candidate query keys are `PLANNED` only:

| Candidate Query | Status | Notes |
| --- | --- | --- |
| Notifications list/unread count | `IMPLEMENTED` | Frontend uses TanStack Query through `frontend-web/src/hooks/useNotifications.js` for account-wide Bell list and unread count; `/ws/notifications` invalidates these queries. |
| Staff tutor review queue | `PLANNED` | Could invalidate on tutor application events. |
| Teaching registrations | `PLANNED` | Could invalidate on teaching/subject review events. |
| Tutor classes/request list | `PARTIAL` | Current frontend uses manual fetch plus `useRealtimeRefresh` for enrollment events instead of a TanStack Query key. |
| Student my classes/requests | `PARTIAL` | Current frontend uses manual fetch plus `useRealtimeRefresh` for enrollment accept/reject events instead of a TanStack Query key. |

## 18. Duplicate Delivery and Idempotency

RabbitMQ may redeliver messages. Notification Service consumers must:

- require a unique `eventId`;
- enforce uniqueness in storage, currently through `UNIQUE(event_id, recipient_user_id)`;
- avoid duplicate notification rows for the same event;
- treat event processing as idempotent.

WebSocket reconnects or retries may duplicate displayed events. Frontend should:

- deduplicate by notification id or event id where available;
- avoid showing repeated identical realtime toasts;
- reconcile Bell state through REST refetch on reconnect/focus.

Current `FeedbackProvider` already avoids duplicate active toasts by matching type, title, and message.

Current `RealtimeProvider` also deduplicates domain and notification toasts for a short window by business reference such as notification type, reference type, and reference id. This avoids duplicate user-facing toasts when `/ws/account` or `/ws/learning` and `/ws/notifications` both report the same business result.

## 19. Security Rules

- Notification recipient authorization must be enforced server-side.
- Do not broadcast sensitive payloads to all users and rely on frontend filtering.
- Prefer user-targeted delivery for user-specific events.
- `activeRole` affects UI context; it is not ownership authorization by itself.
- A dual-role User may receive notifications related to both `STUDENT` and `TUTOR` contexts.
- Do not include CCCD/passport data, document download URLs, private evidence, JWTs, secrets, wallet private keys, or full contract text in notification payloads.
- Browser auth remains cookie/JWT based. Notification Service reads the `access_token` cookie for REST ownership checks and protects mutating REST endpoints with CSRF. Do not change token storage or CSRF behavior for notification/realtime work without explicit approval.

## 20. Financial Rules

Blockchain transaction submission is not financial success.

Financial notifications should be created only after authoritative confirmation, such as:

- escrow funded;
- contract activated;
- session settled;
- payment confirmed;
- refund processed;
- dispute resolved.

Do not treat wallet signature, transaction hash creation, or frontend optimistic state as final settlement.

## 21. Messaging Rules

Messaging backend persistence/API is currently missing. The web messaging UI is partial/mock and must not be treated as a complete feature.

Future message send flow:

1. Local send state in the current conversation.
2. Persistent message storage.
3. Realtime recipient delivery.
4. Unread state update.
5. Bell notification behavior for recipient attention.

Avoid duplicate concepts:

- chat unread state belongs to messaging;
- Bell notification should show a summary or entry point, not duplicate every low-value chat UI state.

## 22. Route Target Rules

Notification click targets must use existing routes when the target feature exists.

Current route targets that may be used:

| Target | Status | Notes |
| --- | --- | --- |
| `/` | `IMPLEMENTED` | Student Web home. |
| `/profile` | `IMPLEMENTED` | Account profile and TutorApplication context section. |
| `/profile/password` | `IMPLEMENTED` | Change password. |
| `/my-classes` | `IMPLEMENTED` | Student enrollment/request page. |
| `/messages` | `PARTIAL` | Student shell; backend messaging missing. |
| `/contracts` | `PARTIAL` | Student shell; contract REST incomplete. |
| `/payments` | `PARTIAL` | Student shell; Web3/payment partial. |
| `/matching` | `PLANNED` | Student shell exists; AI service missing. |
| `/dashboard` | `IMPLEMENTED` | Tutor/Staff/Admin portal shell depending role. |
| `/tutor/teaching-registrations` | `IMPLEMENTED` | Tutor teaching registration page. |
| `/staff/tutors` | `IMPLEMENTED` | Staff/Admin review UI. |

For planned features without existing UI, mark the target as `TBD / FUTURE ROUTE`. Do not invent a current route.

## 23. Rules for AI Agents

Before implementing any feature that writes data, changes business status, affects another user, requires realtime behavior, or produces financial/security state, an AI agent must read this spec.

The agent must:

1. Find the relevant matrix row.
2. Follow the local feedback rule.
3. Follow the persistent notification rule.
4. Follow the realtime rule.
5. Use current source as evidence before marking a status as implemented.
6. Update this spec when feature status changes.
7. Never treat `PLANNED` entries as permission to implement out-of-scope features.

## 24. Feature Status Update Rule

When a future feature is implemented, update this spec in the same task or the follow-up documentation task.

Status transitions:

- `PLANNED` -> `PARTIAL`
- `PLANNED` -> `IMPLEMENTED`
- `PARTIAL` -> `IMPLEMENTED`
- `IMPLEMENTED` -> `DEPRECATED` only after a confirmed replacement decision

Update affected rows with:

- endpoint/API evidence if it exists;
- producer;
- recipient;
- persistent notification behavior;
- realtime behavior;
- Bell behavior;
- click target.

Do not duplicate large implementation details here. Link to source/docs where useful and keep this file as the cross-feature contract.
