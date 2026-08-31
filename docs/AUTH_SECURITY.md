# EduConnect Authentication & Security Baseline

## 1. Authentication Model

EduConnect uses JWT authentication with role-based authorization.

Current Account Service evidence shows login creates a JWT containing user identity, roles, and `activeRole`. The browser access token is stored in an `access_token` cookie. The active role is part of the authentication model and must not be changed casually.

## 2. Browser Token Handling

Current Web authentication is cookie-oriented:

- Account Service sets an `access_token` cookie on login and switch-role.
- The cookie is configured as `HttpOnly`.
- Web API calls use credentialed requests.
- Frontend code should not need to read the access token directly.

Do not migrate browser auth to `localStorage`, `sessionStorage`, or Bearer-only token handling unless the user explicitly confirms a new security design.

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

Before changing authorization, audit both backend security rules and frontend route/UI assumptions.

## 7. Known Security Inconsistencies

Current known inconsistency:

- Account Service JWT filter reads JWT from cookie `access_token`.
- Learning Service JWT filter checks `Authorization: Bearer` first, then cookie `access_token` or `token`.

This is a KNOWN_CONFLICT/technical inconsistency. Do not normalize it silently inside an unrelated task; report impact or ask for confirmation if the task touches auth architecture.

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
