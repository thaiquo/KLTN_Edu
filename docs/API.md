# EduConnect API Baseline

## 1. API Principles

- EduConnect uses REST-style APIs for Web/Mobile integration.
- Each service owns APIs for its domain.
- DTO/request/response models should be separated from Entity models when appropriate.
- Authentication and authorization must follow `docs/AUTH_SECURITY.md`.
- Frontend and Mobile clients must not access databases directly.
- This document is a routing baseline, not a hand-written OpenAPI specification.

## 2. API Ownership

| Domain | Owning Service | Main API Responsibility |
| --- | --- | --- |
| Authentication | `account-service` | Register, verify email, resend OTP, login, refresh session, switch role, logout, forgot/reset password, CSRF endpoint. |
| User/Profile | `account-service` | Current user, profile updates, student activation, avatar, password change. |
| Tutor Profile/Application | `account-service` | Tutor public profile, lightweight identity-document application, staff tutor approval. |
| Reference Geography | `account-service` | Provinces/communes reference data. |
| Teaching Catalog | `learning-service` | Program type, education level, subject category/group/subject/level catalog. |
| Tutor Expertise | `learning-service` | Tutor subject registrations and tutor subject data. |
| Availability | `learning-service` | Tutor availability management. |
| Class/Classroom | `learning-service` | Tutor class management, public class search/detail, staff/admin class monitoring. |
| Enrollment/Join Request | `learning-service` | Student class enrollment requests and tutor accept/reject flows. |
| Contract/Escrow/Settlement | `contract-service` | Contract and blockchain workflow logic exists, but public REST Controller evidence is currently not found. |
| Notification | `notification-service` | Persistent user notifications, unread count, mark one read, mark all read, and limited realtime notification delivery for the authenticated recipient account. |
| AI Matching | Not implemented as a service | Target/planned support for search/recommendation/ranking. |

## 3. Current API Groups

Current large API groups with source evidence:

- Authentication and session lifecycle.
- `POST /api/auth/switch-role` validates role/profile eligibility; switching to `TUTOR` requires approved Tutor and TutorApplication records.
- Current user/profile and avatar.
- Tutor public search/detail.
- Tutor application and document management.
- Tutor application lifecycle: `DRAFT` before submit, `PENDING` after submit, then Staff `APPROVED` or `REJECTED`.
- Restricted Tutor application flow for `DRAFT`/`PENDING`/`REJECTED` tutors through Account Service profile/application/document APIs.
- Current Tutor approval submission requires identity documents only: CCCD/CMND front + back, or passport. Teaching/class registration belongs to full Tutor functionality after approval.
- Staff tutor application approval/rejection.
- Staff/admin user management.
- Reference province/commune lookup.
- Teaching catalog read/admin management.
- Subject requests and catalog suggestions.
- Tutor subject registration.
- Tutor availability.
- Tutor class management.
- Public class search/detail and join-key verification.
- Enrollment request create/cancel/my-requests/accept/reject.
- Enrollment request events on `kltn.edu.events` for `learning.enrollment.requested`, `learning.enrollment.accepted`, `learning.enrollment.rejected`, and `learning.enrollment.cancelled`.
- Staff/admin class monitoring.
- Notification list/count/read state through `notification-service`.
- Notification realtime delivery through `/ws/notifications` for supported persisted notification events.

Contract Service contains workflow/service logic and persistence, but no public REST controller was found during audit.

## 3.1 Notification API

Current Notification Service endpoints:

| Method | Endpoint | Purpose | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/notifications` | List notifications for the authenticated user. | Supports `page`, `size`, `unreadOnly`, and optional `targetRole`. |
| `GET` | `/api/notifications/unread-count` | Return unread notification count for the authenticated user. | Supports optional `targetRole`. |
| `PATCH` | `/api/notifications/{id}/read` | Mark one owned notification as read. | Idempotent for already-read rows. |
| `PATCH` | `/api/notifications/read-all` | Mark all matching owned notifications as read. | Supports optional `targetRole`; returns updated count. |

Current Notification Service WebSocket endpoint:

| Protocol | Endpoint | Purpose | Notes |
| --- | --- | --- | --- |
| Raw WebSocket | `/ws/notifications` | Deliver persisted notification creation events to the authenticated recipient while online. | Routed by `api-gateway` to `notification-service`. REST remains authoritative; clients should invalidate/refetch notification queries after receiving a frame. |

Current realtime envelope:

| Field | Purpose |
| --- | --- |
| `source` | Event source, currently `notification-service`. |
| `eventType` | Envelope type, currently `NOTIFICATION_CREATED`. |
| `notificationId` | Persisted notification id. |
| `notificationType` | Business notification type. |
| `recipientUserId` | Authenticated recipient account id. |
| `targetRole` | Optional role/context hint. |
| `referenceType` | Referenced business object type. |
| `referenceId` | Referenced business object id. |
| `title` | Short UI title. |
| `message` | UI message without sensitive payload. |
| `createdAt` | Server timestamp. |

Security and ownership:

- The service reads the current user from the `access_token` cookie JWT.
- Clients must not send `recipientUserId`; ownership is derived server-side.
- Mutating endpoints require the normal browser CSRF header.
- Notification click routing is a frontend concern and should use existing routes from `docs/FEEDBACK_NOTIFICATION_SPEC.md`.
- WebSocket notification sessions are authenticated through the same browser cookie principal. The server sends user-specific notification frames only to matching `recipientUserId` sessions.

## 3.2 Enrollment Notification Events

Learning Service publishes enrollment events to the shared RabbitMQ exchange `kltn.edu.events` after the enrollment transaction commits.

| Event | Routing Key | Actor | Recipient | Reference |
| --- | --- | --- | --- | --- |
| `ENROLLMENT_REQUESTED` | `learning.enrollment.requested` | Student | Tutor | `ENROLLMENT_REQUEST` / enrollment request id |
| `ENROLLMENT_ACCEPTED` | `learning.enrollment.accepted` | Tutor | Student | `ENROLLMENT_REQUEST` / enrollment request id |
| `ENROLLMENT_REJECTED` | `learning.enrollment.rejected` | Tutor/system capacity cleanup | Student | `ENROLLMENT_REQUEST` / enrollment request id |
| `ENROLLMENT_CANCELLED` | `learning.enrollment.cancelled` | Student | Tutor | `ENROLLMENT_REQUEST` / enrollment request id |

Current enrollment event payload shape:

| Field | Purpose |
| --- | --- |
| `eventId` | Unique idempotency key for the business event. |
| `eventType` | One of the enrollment events above. |
| `occurredAt` | Producer timestamp. |
| `producer` | Current value: `learning-service`. |
| `enrollmentRequestId` | Enrollment request id. |
| `classId` | Class id. |
| `recipientUserId` | Notification recipient account id resolved by the producer. |
| `actorUserId` | User id of the actor when available. |
| `classTitle` | Safe display class name. |
| `reviewStatus` | Result/status hint such as `PENDING`, `ACCEPTED`, `REJECTED`, or `CANCELLED`. |
| `rejectReason` | Safe rejection reason when supported. |
| `studentName` | Safe display student name when submitted. |

Notification Service consumes these events, persists account-owned notifications, and `/ws/notifications` delivers `NOTIFICATION_CREATED` to the recipient while online. Clients must still refetch authoritative REST state.

## 4. API Status Principle

Treat API status carefully:

- Controller + route + service flow + persistence/security evidence can support IMPLEMENTED or PARTIAL status.
- Service logic without a public Controller is not a public API.
- UI code calling or mocking a feature is not proof that the backend API exists.
- Planned target capabilities should not be documented as current APIs.

## 5. Request/Response Convention

Current backend source shows common use of:

- request/response DTOs;
- Bean Validation such as `@Valid`;
- `ResponseEntity` for explicit HTTP responses;
- centralized exception handling;
- pagination/filter parameters in selected list/search APIs.

Keep new APIs consistent with nearby controllers in the owning service.

## 6. Authentication Requirements

Authenticated APIs must follow the JWT/cookie/CSRF/role baseline in `docs/AUTH_SECURITY.md`.

Tutor API distinction:

- Account Service owns Tutor application/profile-review APIs that authenticated restricted Tutors need for identity-document submission/correction. These APIs do not imply full teaching permission.
- Learning Service owns full teaching operation APIs. These require approved Tutor eligibility and must not be opened to `PENDING`/`REJECTED` Tutors by frontend hiding alone.

Before adding or changing an API, audit:

- whether the endpoint is public or authenticated;
- which role(s) can access it;
- whether the active role matters;
- whether browser calls require CSRF handling.

## 7. Frontend/Mobile Integration

Web uses API client modules under `frontend-web/src/api` with credentialed requests and CSRF handling.

Mobile is an Expo/React Native app with basic API integration through `mobile-app/src/api.js` and auth context. Mobile is not feature-equivalent with Web and should not be assumed to have every Web flow.

## 8. Cross-Service API Rule

- Identify the owning service before adding an endpoint.
- Do not duplicate business logic already owned by another service.
- Do not query another service's database directly.
- Use API or events for cross-domain integration when a flow crosses service boundaries.
- Check gateway routing if the endpoint must be reachable through `api-gateway`.

## 9. Where to Audit Before Adding API

Before adding or modifying an API, inspect the relevant:

- Controller;
- request/response DTOs;
- Service layer;
- Repository/Entity/migration;
- SecurityConfig and `@PreAuthorize`;
- frontend API client/component;
- mobile API call/screen if applicable;
- gateway route if the API is exposed through the gateway;
- event producer/consumer if the API triggers cross-service work.
