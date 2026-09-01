# EduConnect Authentication & Security Baseline

## 1. Authentication Model

EduConnect uses JWT authentication with role-based authorization.

Current Account Service evidence shows login creates a short-lived JWT containing user identity, roles, and `activeRole`. The browser access token is stored in an `access_token` cookie. A separate refresh token is stored in a `refresh_token` HttpOnly cookie and persisted server-side as a hash-backed refresh session. The active role is part of the authentication model and must not be changed casually.

## 2. Browser Token Handling

Current Web authentication is cookie-oriented:

- Account Service sets an `access_token` cookie on login, refresh, and switch-role.
- Account Service sets a `refresh_token` cookie on login and refresh.
- Both auth cookies are configured as `HttpOnly`.
- Access token lifetime defaults to 15 minutes.
- Refresh token lifetime defaults to 7 days.
- Refresh token rotation revokes the previous refresh session and issues a replacement.
- Web API calls use credentialed requests.
- Frontend code should not read the access or refresh token directly.

Do not migrate browser auth to `localStorage`, `sessionStorage`, or Bearer-only token handling unless the user explicitly confirms a new security design.

## 2.1 Refresh Session Model

Refresh tokens are random high-entropy secrets. The raw refresh token only exists when generated and inside the browser cookie/request. The database stores a deterministic SHA-256 hash for lookup, not the raw token.

Current refresh behavior:

- `POST /api/auth/refresh` reads `refresh_token`.
- A valid refresh session must exist, be unexpired, not revoked, and belong to an active verified user.
- Successful refresh revokes the old refresh session, creates a replacement, sets new `access_token` and `refresh_token` cookies, and returns a safe user response without token values.
- Logout revokes the current refresh session if present and clears both auth cookies.
- Reset password and change password revoke all refresh sessions for the user.

## 3. CSRF

Because browser authentication uses cookies, CSRF must be considered.

Current source evidence:

- Account Service exposes a CSRF endpoint through Auth Controller.
- Account and Learning security configs use `CookieCsrfTokenRepository.withHttpOnlyFalse()`.
- Web API client obtains `XSRF-TOKEN` and sends `X-XSRF-TOKEN` on mutating requests.

Do not disable CSRF just to make a request pass. If an API call fails due to CSRF, audit the frontend credentials/header flow and the relevant Spring Security configuration.

## 4. CORS

Current gateway configuration allows credentialed local frontend origins and exposes `Set-Cookie`.

When changing CORS:

- keep credentialed request behavior aligned with cookie auth;
- use explicit allowed origins or origin patterns;
- avoid broad wildcard behavior for authenticated browser requests.

## 5. Role & Active Role

Baseline model:

User -> roles/profiles -> active role -> JWT claim -> authorization.

Core roles:

- `STUDENT`
- `TUTOR`
- `STAFF`
- `ADMIN`

The active role is used to determine the user's current operating context. Do not remove or bypass it without a confirmed design change.

## 6. Authorization

Authorization is enforced through Spring Security configuration and method/endpoint annotations such as `@PreAuthorize`.

Current examples include:

- tutor-only learning APIs for class, availability, and subject registration;
- staff/admin account APIs for tutor approval and user management;
- admin/staff learning APIs for catalog and class moderation;
- public read/search APIs for selected catalog, tutor, and class resources.

Tutor authorization baseline:

- Tutor application `DRAFT`, `PENDING`, and `REJECTED` states may authenticate with `activeRole=TUTOR`, but they must not receive full teaching authority.
- `TutorApplication.status=DRAFT` means the Tutor account/application exists but has not been submitted for Staff review. `PENDING` means the application has been submitted and is awaiting Staff review.
- Account Service grants `ROLE_TUTOR` only when the current Tutor status is `APPROVED`.
- `POST /api/auth/switch-role` only allows switching into Tutor mode when both the Tutor record and TutorApplication are `APPROVED`; `DRAFT`, `PENDING`, and `REJECTED` are denied at the backend even if the user has a compatibility `TUTOR` role row.
- Account Service self profile/application endpoints remain available to authenticated Tutor users for identity-document submission/correction without granting full `ROLE_TUTOR`.
- Learning Service uses its local tutor authorization projection from Account approval/rejection events as the priority source for full Tutor APIs. If no projection exists yet, it may fall back to the signed JWT `tutorStatus=APPROVED` claim after token refresh/switch-role.
- Full Tutor APIs remain `APPROVED`-only even when the browser has a valid `access_token` cookie and `activeRole=TUTOR`.

Before changing authorization, audit both backend security rules and frontend route/UI assumptions.

## 7. Known Security Inconsistencies

Current JWT extraction policy:

- Account Service JWT filter reads JWT from cookie `access_token`.
- Learning Service JWT filter reads JWT from cookie `access_token`.
- Browser requests must not depend on `Authorization: Bearer` or legacy cookie `token`.

Mobile currently uses credentialed API requests, but the CSRF flow is not as complete as Web and should be audited before expanding mobile mutating APIs.

## 8. Security Guardrails

- Do not store browser access tokens in `localStorage`.
- Do not store browser access tokens in `sessionStorage`.
- Do not migrate to Bearer-only browser auth without explicit confirmation.
- Do not disable CSRF casually.
- Do not change the role/active-role model without explicit confirmation.
- Do not hard-code secrets, private keys, JWT secrets, cloud credentials, or wallet keys.
- Do not expose sensitive token values in logs or documentation.

## 9. Where to Audit

- Account security config/filter/auth: `backend/account-service/src/main/java`.
- Learning security config/filter: `backend/learning-service/src/main/java`.
- Gateway CORS/routing: `backend/api-gateway/src/main/resources/application.properties`.
- Web API auth/CSRF handling: `frontend-web/src/api`.
- Mobile API auth behavior: `mobile-app`.
