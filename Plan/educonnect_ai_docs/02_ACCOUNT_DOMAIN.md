# EDUCONNECT — ACCOUNT DOMAIN

## 1. Trách nhiệm Account Service

Account Service là Identity + Account Domain:
- register/login/logout,
- refresh token,
- password/forgot password/OTP,
- JWT,
- User,
- Role,
- UserRole,
- Profile,
- TutorProfile,
- TutorApplication,
- Certificate,
- Admin/Staff.

## 2. User / Role model

Khuyến nghị:

```text
User
- id
- email
- passwordHash
- status
- isVerified
- createdAt
- updatedAt

Role
- id
- name

UserRole
- id
- userId
- roleId
- assignedAt
- assignedBy
- status
```

Allowed business roles:
```text
STUDENT
TUTOR
STAFF
ADMIN
```

## 3. Registration

Mặc định:

```text
Register
  ↓
Create User
  ↓
Create Profile
  ↓
Assign STUDENT
```

Không mặc định TUTOR.

## 4. Tutor upgrade

```text
STUDENT
  ↓
Create TutorApplication
  ↓
Chọn môn / cấp lớp dự định dạy
  ↓
Upload certificates
  ↓
Submit
  ↓
Staff/Admin review
  ├─ REJECTED
  └─ APPROVED
       ↓
     Activate TutorProfile
       ↓
     Add TUTOR role
```

Sau approve:
```text
roles = [STUDENT, TUTOR]
```

Tutor vẫn có thể dùng hệ thống như Student.

## 5. Profile separation

### Profile
Thông tin chung của user:
- fullName
- avatar
- phone
- gender nếu hệ thống cần
- dateOfBirth nếu hệ thống cần
- address/profile bio cơ bản

### TutorProfile
Thông tin định danh / xác minh Tutor:
- userId
- introduction
- experienceYears
- verificationStatus
- verifiedAt
- rating summary nếu cần read model

### Không đặt ở Account
Thông tin phục vụ matching/dạy học:
- subject dạy,
- grade/level,
- hourly rate,
- teaching mode,
- availability.

Các phần trên thuộc Learning Service.

## 6. Active role

Nếu frontend có switch Student/Tutor:
- activeRole là UI/context.
- Authorization vẫn dựa trên roles thật trong JWT/database.
- Không dùng activeRole để cấp quyền vượt quá role thật.

## 7. API gợi ý

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout

GET  /users/me
PUT  /users/me/profile

POST /tutor-applications
PUT  /tutor-applications/{id}
POST /tutor-applications/{id}/submit

GET  /admin/tutor-applications
POST /admin/tutor-applications/{id}/approve
POST /admin/tutor-applications/{id}/reject
```

## 8. Event quan trọng

Khi tutor được duyệt, Account có thể phát:

```text
tutor.approved
```

Payload tối thiểu:
```json
{
  "eventId": "...",
  "eventType": "tutor.approved",
  "tutorId": "...",
  "occurredAt": "..."
}
```

Learning Service có thể dùng event này để cho phép tutor cấu hình teaching profile.
