# Account Service Blueprint
Version: 1.0
Status: Final
Purpose: Architecture Review Baseline

---

# 1. Purpose

Account Service là Identity Service của toàn hệ thống.

Service này chỉ chịu trách nhiệm:

- Identity
- Authentication
- Authorization
- Session Management
- Basic Profile
- Security
- Audit
- Domain Event Publishing

Không được chứa business của service khác.

---

# 2. Responsibilities

## Bao gồm

- Register
- Login
- Logout
- Logout All
- Refresh Token
- Verify Email
- Resend Verification
- Forgot Password
- Reset Password
- Change Password
- Current User
- Update Basic Profile
- Manage Account Status
- Session Management
- Login History
- Security Audit
- Publish Domain Events

---

## Không bao gồm

- Tutor Profile
- Student Profile chuyên sâu
- Subject
- Certificate
- Teaching Schedule
- Learning Domain
- AI Matching
- Contract
- Payment
- Notification
- Blockchain Logic

---

# 3. Role Strategy

Role sử dụng enum cố định.

Không sử dụng Dynamic RBAC.

Không có:

- roles table
- permissions table
- account_roles
- role_permissions

Role gồm:

- ADMIN
- STAFF
- TUTOR
- STUDENT

Authorization sử dụng Spring Security.

Ví dụ:

- @PreAuthorize
- hasRole(...)
- hasAuthority(...)

---

# 4. Authentication Strategy

Authentication sử dụng JWT.

Access Token

- HttpOnly Cookie
- Secure
- SameSite=Lax
- Short Expiration

Refresh Token

- HttpOnly Cookie
- Secure
- SameSite=Lax
- Long Expiration

Frontend

- withCredentials=true

Không lưu token trong

- localStorage
- sessionStorage

Login Response không trả Access Token trong JSON.

Refresh Response cũng không trả token trong JSON.

Token được gửi qua Cookie.

---

# 5. Cookie Requirements

Cookie phải có

- HttpOnly
- Secure
- SameSite=Lax
- Path
- MaxAge

Logout phải xóa Cookie.

Refresh phải cập nhật Cookie mới.

---

# 6. CSRF

Nếu sử dụng Cookie Authentication thì phải có:

Một trong hai:

- Spring Security CSRF
hoặc

- Double Submit Cookie

Nếu không có phải được đánh dấu là thiếu.

---

# 7. Session Management

Phải có Session.

Account

1 - N

Session

Session

1 - N

Refresh Token

Session hỗ trợ

- Logout Device
- Logout All
- Recent Login
- Trusted Device (Optional)
- Session Revocation

---

# 8. Refresh Token

Refresh Token phải:

- Hash trước khi lưu DB
- Rotation
- Revocation
- Family ID
- Reuse Detection

Nếu phát hiện reuse

→ revoke toàn bộ family.

---

# 9. Verification Token

Chỉ dùng một bảng.

verification_tokens

Dùng type phân loại

- VERIFY_EMAIL
- RESET_PASSWORD
- CHANGE_EMAIL
- VERIFY_PHONE

Không tạo nhiều bảng riêng.

---

# 10. Database

Các bảng tối thiểu

accounts

account_profiles

sessions

refresh_tokens

verification_tokens

login_histories

security_audits

outbox_events

Kiểm tra

- PK
- FK
- Unique
- Index

---

# 11. Redis

Redis chỉ dùng cho

- OTP
- Verification Code
- Rate Limiting
- JWT Blacklist
- Session Cache

Không lưu dữ liệu User chính.

---

# 12. Event Driven

Sử dụng RabbitMQ.

Sử dụng Outbox Pattern.

Event tối thiểu

- AccountRegistered
- EmailVerified
- PasswordChanged
- ProfileUpdated
- AccountStatusChanged
- SessionCreated
- SessionRevoked
- RefreshTokenRotated
- RefreshReuseDetected
- LogoutCompleted

Có

- Retry
- DLQ
- Idempotency

---

# 13. Domain

Aggregate Root

Account

Entities

- Account
- AccountProfile
- Session
- RefreshToken
- VerificationToken
- LoginHistory
- SecurityAudit
- OutboxEvent

Value Objects

- Email
- PhoneNumber
- FullName
- AvatarUrl
- TokenHash
- IpAddress
- UserAgent

Enums

- Role
- AccountStatus
- SessionStatus
- VerificationType
- VerificationStatus
- AuditAction

---

# 14. Package Structure

Nên có

authentication

account

profile

token

session

verification

audit

event

security

common

infrastructure

Infrastructure gồm

config

security

cookie

redis

rabbitmq

persistence

---

# 15. REST API

Authentication

POST /auth/register

POST /auth/login

POST /auth/logout

POST /auth/logout-all

POST /auth/refresh

POST /auth/forgot-password

POST /auth/reset-password

POST /auth/verify-email

POST /auth/resend-verification

---

Profile

GET /me

PUT /me

PUT /me/password

---

Session

GET /auth/me/sessions

DELETE /auth/me/sessions/{id}

---

Admin

GET /admin/accounts

PATCH /admin/accounts/{id}/status

---

# 16. Security

Phải có

Spring Security

JWT

Password Encoder

Cookie Authentication

Password Policy

Failed Login Counter

Account Lock

Security Audit

Login History

Rate Limiting

---

# 17. Logging

Nên log

- Register
- Login Success
- Login Failure
- Logout
- Refresh
- Password Change
- Session
- Event Publish
- Event Consume

Có

Correlation ID

Account ID

IP

User Agent

Không log

- Password
- JWT
- Refresh Token
- Cookie
- OTP
- Secret Key

---

# 18. Validation

Kiểm tra

Email

Password

Phone

Role

Token

DTO Validation

Business Validation

---

# 19. Flyway

Schema được quản lý bằng Flyway.

Không sử dụng

ddl-auto=create

ddl-auto=update

---

# 20. MapStruct

Sử dụng MapStruct cho

Entity

DTO

Request

Response

Không map thủ công quá nhiều.

---

# 21. Swagger

Có OpenAPI.

Có Swagger UI.

Có Security Scheme.

Có mô tả Cookie Authentication.

---

# 22. Testing

Phải có

Unit Test

Integration Test

Authentication Test

Cookie Flow Test

Refresh Token Test

Session Test

Event Test

Outbox Test

RabbitMQ Test

CSRF Test

---

# 23. Review Rules

Khi review source code:

Không viết code.

Không refactor.

Không tự thiết kế lại.

Chỉ đối chiếu với blueprint này.

Đánh giá theo các mức:

✅ Đã có

⚠️ Cần cải thiện

❌ Thiếu

Nếu không đủ dữ liệu để kết luận thì ghi:

"Không đủ thông tin để xác minh."

Không được suy đoán.

---

# 24. Expected Review Output

Sau khi đọc source code hãy trả về:

## 1. Overall Completion

Đánh giá % hoàn thiện.

---

## 2. Architecture Checklist

| Module | Status | Comment |

---

## 3. Missing Features

Liệt kê đầy đủ.

---

## 4. Security Review

Thiếu gì.

Sai gì.

Nguy cơ gì.

---

## 5. Database Review

Thiếu bảng.

Thiếu Index.

Thiếu Constraint.

Thiếu Migration.

---

## 6. Event Review

Publish

Consume

RabbitMQ

Retry

DLQ

Outbox

Idempotency

---

## 7. API Review

API nào thiếu.

API nào dư.

API nào sai.

---

## 8. Package Review

Đúng hay sai cấu trúc.

---

## 9. Test Coverage Review

Thiếu Unit Test.

Thiếu Integration Test.

Thiếu Security Test.

---

## 10. Production Readiness

Đánh giá

Architecture

Security

Maintainability

Scalability

Testing

Documentation

Production Ready

Thang điểm 10.

---

## 11. Priority Roadmap

Priority 1

Priority 2

Priority 3

Priority 4

Không viết code.

Chỉ phân tích.