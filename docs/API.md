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
| AI Matching | Not implemented as a service | Target/planned support for search/recommendation/ranking. |

## 3. Current API Groups

Current large API groups with source evidence:

- Authentication and session lifecycle.
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
- Staff/admin class monitoring.

Contract Service contains workflow/service logic and persistence, but no public REST controller was found during audit.

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
