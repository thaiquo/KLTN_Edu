# EDUCONNECT SPRING BOOT BACKEND — SERVICE-BASED ARCHITECTURE MASTER PLAN

## 1. Mục tiêu tài liệu

Tài liệu này là **nguồn hướng dẫn chính** để AI Coding Assistant triển khai, refactor và hoàn thiện backend Spring Boot cho hệ thống EduConnect.

Mục tiêu là giữ hệ thống bám sát:

- **Service-Based Architecture**
- Spring Boot
- API Gateway
- PostgreSQL
- JWT + RBAC
- RabbitMQ cho giao tiếp bất đồng bộ
- Outbox Pattern
- Saga Pattern khi thật sự cần
- Hybrid Recommendation
- Blockchain Contract Hash
- Escrow Payment
- Realtime Chat / WebSocket
- Notification / Email

AI Coding Assistant **không được tự ý đổi kiến trúc chính**, không tự tách thêm microservice và không tự triển khai các phase sau nếu chưa được yêu cầu.

---

# 2. Kiến trúc chính

Kiến trúc chính của hệ thống là:

# **Service-Based Architecture**

Không mô tả hệ thống là Microservices Architecture.

Hệ thống được chia thành các service lớn theo **business capability/domain**, mỗi service quản lý một nhóm nghiệp vụ có tính liên kết cao.

Kiến trúc cuối cùng:

```text
backend/
│
├── api-gateway/
│
├── account-service/
│
├── learning-service/
│
├── contract-service/
│
├── notification-service/
│
├── docker-compose.yml
└── .env
```

Sơ đồ tổng thể:

```text
                         WEB / MOBILE
                              │
                              │ HTTPS / WSS
                              ▼
                    ┌──────────────────┐
                    │   API GATEWAY    │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼───────────────────┐
          │                  │                   │
          ▼                  ▼                   ▼
 ┌────────────────┐ ┌─────────────────┐ ┌─────────────────┐
 │ Account Service│ │ Learning Service│ │ Contract Service│
 │                │ │                 │ │                 │
 │ Auth           │ │ Subject         │ │ Contract        │
 │ User           │ │ LearningRequest │ │ Payment         │
 │ Role / RBAC    │ │ Matching        │ │ Wallet          │
 │ Profile        │ │ Availability    │ │ Escrow          │
 │ Tutor Apply    │ │ Classroom       │ │ Blockchain      │
 │ Certificate    │ │ Session         │ │                 │
 │ Admin          │ │ Attendance      │ │                 │
 └────────────────┘ │ Assignment      │ └─────────────────┘
                    │ Submission      │
                    │ Review          │
                    └────────┬────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Notification Service │
                  │                      │
                  │ Notification         │
                  │ Email                │
                  │ Chat / WebSocket     │
                  └──────────────────────┘
```

---

# 3. Nguyên tắc Service-Based Architecture

Không chia service theo từng entity hoặc từng chức năng nhỏ.

Ví dụ:

```text
LearningRequest
Matching
Classroom
Session
Attendance
Assignment
Submission
```

đều thuộc cùng:

```text
Learning Service
```

Tương tự:

```text
Contract
Payment
Wallet
Escrow
Blockchain
```

đều thuộc:

```text
Contract Service
```

Không tự tạo:

```text
matching-service
payment-service
wallet-service
session-service
assignment-service
chat-service
```

nếu chưa có yêu cầu kiến trúc mới.

Quy tắc:

> Business capability có cohesion cao thì giữ chung một deployable service.

Chỉ cân nhắc tách service khi có lý do rõ ràng:

- scale độc lập,
- technology stack khác,
- deployment độc lập,
- fault isolation,
- workload đặc biệt,
- database ownership riêng rõ ràng,
- team ownership riêng.

---

# 4. API Gateway

## 4.1 Trách nhiệm

API Gateway chỉ chịu trách nhiệm:

- Routing
- Authentication filter
- CORS
- Rate limiting
- Request logging
- Correlation ID
- Forward request đến service phù hợp

Không chứa business logic.

Không chứa repository nghiệp vụ.

Không quản lý trực tiếp User, Learning, Payment, Contract.

Flow:

```text
Client
  ↓
API Gateway
  ↓
Account / Learning / Contract / Notification
```

---

# 5. Account Service

Account Service là:

# **Identity + Account Domain**

Không giữ `auth-service` riêng.

Auth phải được gộp vào `account-service`.

## 5.1 Trách nhiệm

Account Service quản lý:

- Register
- Login
- Logout
- Refresh Token
- OTP
- Forgot Password
- Password
- JWT
- User
- Profile
- Role
- UserRole
- TutorProfile
- TutorApplication
- Certificate
- Tutor verification
- Admin/Staff

---

# 6. Account Service Structure

```text
account-service/
└── src/main/java/.../
    ├── modules/
    │   ├── auth/
    │   │   ├── controller/
    │   │   ├── service/
    │   │   ├── dto/
    │   │   └── security/
    │   │
    │   ├── user/
    │   │   ├── entity/
    │   │   ├── repository/
    │   │   ├── service/
    │   │   ├── controller/
    │   │   └── dto/
    │   │
    │   ├── profile/
    │   │
    │   ├── role/
    │   │
    │   ├── tutor/
    │   │   ├── tutorprofile/
    │   │   ├── tutorapplication/
    │   │   ├── certificate/
    │   │   └── verification/
    │   │
    │   └── staff/
    │
    ├── infrastructure/
    │   ├── security/
    │   ├── mail/
    │   ├── storage/
    │   └── messaging/
    │
    └── shared/
```

---

# 7. User và Role Model

## 7.1 Business Rule

Một User có thể có nhiều Role.

Role cơ bản:

```text
STUDENT
TUTOR
ADMIN
```

Mỗi user mới đăng ký mặc định:

```text
roles = [STUDENT]
```

Không tạo role TUTOR ngay.

---

# 8. Tutor Upgrade Flow

User ban đầu là STUDENT.

Nếu muốn trở thành Tutor:

```text
STUDENT
↓
Create Tutor Application
↓
Upload Certificate
↓
Submit Application
↓
Admin Review
↓
APPROVED
↓
Add TUTOR Role
```

Sau khi approved:

```text
roles = [STUDENT, TUTOR]
```

Không thay thế STUDENT bằng TUTOR.

Không xóa STUDENT.

Tutor vẫn có thể học như Student.

---

# 9. Active Role

Không lưu `currentRole` lâu dài trong database.

Mỗi lần login:

```text
activeRole = STUDENT
```

kể cả user có:

```text
roles = [STUDENT, TUTOR]
```

Frontend có thể switch:

```text
STUDENT <-> TUTOR
```

Switch chỉ thay đổi UI/context hiện tại.

Không làm thay đổi role thực tế trong database.

Logout rồi login lại:

```text
activeRole = STUDENT
```

---

# 10. JWT

JWT nên chứa:

```json
{
  "sub": "user-id",
  "roles": ["STUDENT", "TUTOR"]
}
```

Không bắt buộc chứa `activeRole`.

Authorization dựa trên role thật:

```java
@PreAuthorize("hasRole('TUTOR')")
```

Không dùng `activeRole` làm nguồn authorization duy nhất.

---

# 11. User Entity

## Task A1

```text
User
--------------------
id
email
passwordHash
status
isVerified
createdAt
updatedAt
```

Không lưu:

```text
currentRole
```

---

# 12. Role Entity

## Task A2

```text
Role
--------------------
id
name
```

Allowed:

```text
STUDENT
TUTOR
ADMIN
```

---

# 13. UserRole Entity

## Task A3

Nên dùng entity riêng:

```text
UserRole
--------------------
id
userId
roleId
assignedAt
assignedBy
status
```

Không dùng một field đơn:

```text
User.role
```

Quan hệ:

```text
User
 1
 │
 *
UserRole
 *
 │
 1
Role
```

---

# 14. Registration

## Task A4

API:

```text
POST /auth/register
```

Flow:

```text
Validate email
↓
Hash password
↓
Create User
↓
Create Profile
↓
Assign STUDENT role
↓
Return account
```

Nên nằm trong cùng transaction.

---

# 15. Login

## Task A5

API:

```text
POST /auth/login
```

Flow:

```text
Authenticate email/password
↓
Load user roles
↓
Generate JWT
↓
Return:
- accessToken
- refreshToken
- user
- roles
- activeRole = STUDENT
```

---

# 16. TutorApplication

## Task A6

```text
TutorApplication
--------------------
id
userId
status
submittedAt
reviewedAt
reviewedBy
rejectionReason
createdAt
updatedAt
```

Status:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
```

---

# 17. Certificate

## Task A7

```text
Certificate
--------------------
id
tutorApplicationId
name
issuer
issueDate
expiryDate
fileUrl
verificationStatus
createdAt
```

---

# 18. TutorProfile

## Task A8

TutorProfile thuộc Account Service.

```text
TutorProfile
--------------------
id
userId
bio
experienceYears
verificationStatus
createdAt
updatedAt
```

Không lưu Tutor Availability tại đây.

---

# 19. Tutor Application APIs

## Task A9

```text
POST /tutor-applications
PUT /tutor-applications/{id}
POST /tutor-applications/{id}/submit
```

Rule:

- user phải có STUDENT role,
- chưa có TUTOR role,
- hồ sơ phải hợp lệ,
- certificate theo rule hiện tại,
- status phải cho phép chuyển trạng thái.

---

# 20. Admin Tutor Verification

## Task A10

```text
GET /admin/tutor-applications

POST /admin/tutor-applications/{id}/approve

POST /admin/tutor-applications/{id}/reject
```

Approve flow:

```text
Application APPROVED
↓
Create/Activate TutorProfile
↓
Add TUTOR role
```

Sau approve:

```text
roles = [STUDENT, TUTOR]
```

---

# 21. Learning Service

Learning Service là core business service lớn nhất.

Không tách thêm service.

## 21.1 Trách nhiệm

- Subject
- LearningRequest
- TutorTeachingProfile
- TutorAvailability
- Matching
- Recommendation
- Classroom
- Enrollment
- Session
- Attendance
- Assignment
- Submission
- Review

---

# 22. Learning Service Structure

```text
learning-service/
└── src/main/java/.../
    ├── modules/
    │   ├── subject/
    │   ├── learningrequest/
    │   ├── tutorteachingprofile/
    │   ├── availability/
    │   ├── matching/
    │   │   ├── strategy/
    │   │   └── scoring/
    │   ├── classroom/
    │   ├── enrollment/
    │   ├── session/
    │   ├── attendance/
    │   ├── assignment/
    │   ├── submission/
    │   └── review/
    │
    ├── infrastructure/
    │   ├── client/
    │   ├── messaging/
    │   └── persistence/
    │
    └── shared/
```

---

# 23. Không duplicate Student/Tutor Profile trong Learning

Nếu đang có:

```text
learning-service/modules/student
learning-service/modules/tutor
```

thì kiểm tra.

Nếu chúng chứa:

- name,
- email,
- avatar,
- profile,
- certificate,
- account info,

thì chuyển ownership sang Account Service.

Learning chỉ giữ:

```text
studentId
tutorId
```

---

# 24. TutorTeachingProfile

## Task L1

```text
TutorTeachingProfile
--------------------
id
tutorId
hourlyRate
teachingMode
locations
status
createdAt
updatedAt
```

Có thể liên kết:

```text
TutorSubject
TutorLevel
```

TutorTeachingProfile thuộc Learning vì phục vụ dạy học và Matching.

---

# 25. TutorAvailability

Đổi khái niệm `Schedule` thành:

```text
TutorAvailability
```

## Task L2

```text
TutorAvailability
--------------------
id
tutorId
dayOfWeek
startTime
endTime
status
createdAt
updatedAt
```

Ý nghĩa:

```text
"Tôi rảnh thứ 2 từ 19:00 đến 21:00"
```

Không nhầm với Session.

---

# 26. Availability APIs

## Task L3

```text
GET /tutors/{id}/availability

GET /tutors/me/availability

PUT /tutors/me/availability
```

Business rule:

Nếu availability đang được dùng bởi active class/session thì không được update/delete gây conflict.

Trả:

```http
409 Conflict
```

Ví dụ:

```json
{
  "code": "AVAILABILITY_IN_USE",
  "message": "Cannot update availability because it is used by an active class"
}
```

Rule phải được enforce ở backend.

---

# 27. Subject

## Task L4

```text
Subject
--------------------
id
name
description
status
```

Tutor có thể dạy nhiều Subject.

LearningRequest chọn Subject.

Matching sử dụng Subject.

---

# 28. LearningRequest

## Task L5

```text
LearningRequest
--------------------
id
studentId
subjectId
budgetMin
budgetMax
learningMode
location
expectedStartDate
description
status
createdAt
updatedAt
```

Có thể có:

```text
LearningRequestTimeSlot
```

Status:

```text
OPEN
MATCHING
MATCHED
CLOSED
CANCELLED
```

---

# 29. Learning Request APIs

## Task L6

```text
POST /learning-requests

GET /learning-requests/me

GET /learning-requests/{id}

PUT /learning-requests/{id}

DELETE /learning-requests/{id}
```

Authorization:

Student chỉ sửa request của chính mình.

---

# 30. AI Matching Architecture

Matching nằm trong Learning Service.

Không tách thành service riêng.

Structure:

```text
matching/
├── controller/
├── service/
├── strategy/
│   ├── RecommendationStrategy.java
│   ├── RuleBasedStrategy.java
│   ├── ContentBasedStrategy.java
│   ├── CollaborativeFilteringStrategy.java
│   └── HybridRecommendationStrategy.java
│
└── scoring/
    ├── SubjectScoreCalculator.java
    ├── BudgetScoreCalculator.java
    ├── AvailabilityScoreCalculator.java
    ├── LearningModeScoreCalculator.java
    ├── LocationScoreCalculator.java
    ├── RatingScoreCalculator.java
    └── ExperienceScoreCalculator.java
```

---

# 31. Strategy Pattern

## Task L7

```java
public interface RecommendationStrategy {

    List<TutorRecommendation> recommend(
        RecommendationContext context
    );
}
```

Không hard-code toàn bộ recommendation trong controller.

---

# 32. Recommendation Implementation Order

Phải làm đúng thứ tự:

```text
1. Business Rule Filtering
2. Content-Based Filtering
3. Interaction Tracking
4. Collaborative Filtering
5. Hybrid Recommendation
```

Không implement Hybrid trước.

---

# 33. Rule-Based Filtering

## Task L8

Hard constraints:

- tutor có TUTOR role,
- tutor đã được verified,
- đúng Subject,
- availability overlap,
- teaching mode phù hợp,
- hourlyRate phù hợp,
- tutor active.

Output:

```text
Candidate Tutors
```

---

# 34. Content-Based Filtering

## Task L9

Score theo:

- Subject
- Budget
- Availability
- Learning Mode
- Location
- Rating
- Experience

Ví dụ:

```text
contentScore =
subjectScore * subjectWeight
+
budgetScore * budgetWeight
+
availabilityScore * availabilityWeight
+
learningModeScore * learningModeWeight
+
locationScore * locationWeight
+
ratingScore * ratingWeight
+
experienceScore * experienceWeight
```

Weights phải cấu hình được.

---

# 35. MatchingInteraction

## Task L10

```text
MatchingInteraction
--------------------
id
studentId
tutorId
learningRequestId
eventType
value
createdAt
```

Event types:

```text
RECOMMENDED
VIEW_TUTOR
CLICK_TUTOR
SAVE_TUTOR
CONTACT_TUTOR
ACCEPT_TUTOR
REJECT_TUTOR
ENROLL
COMPLETE_CLASS
REVIEW
```

Mục đích là chuẩn bị dữ liệu cho Collaborative Filtering.

---

# 36. Collaborative Filtering

## Task L11

Chỉ làm sau khi interaction tracking tồn tại.

Không gọi logic là Collaborative Filtering nếu chỉ dùng rating hoặc rule.

Phải dựa trên:

- interaction history,
- enrollment history,
- accepted matches,
- review history,
- behavior của users tương tự.

---

# 37. Hybrid Recommendation

## Task L12

Kết hợp:

```text
Business Rules
+
Content-Based
+
Collaborative Filtering
```

Ví dụ:

```text
hybridScore =
contentWeight * contentScore
+
collaborativeWeight * collaborativeScore
```

Weights cấu hình được.

---

# 38. Classroom

## Task L13

```text
Classroom
--------------------
id
tutorId
subjectId
name
description
price
status
type
maxStudents
startDate
endDate
contractId
```

Không duplicate User/Tutor entity.

---

# 39. Enrollment

## Task L14

```text
Enrollment
--------------------
id
classroomId
studentId
status
joinedAt
```

---

# 40. Session

## Task L15

```text
Session
--------------------
id
classroomId
date
startTime
endTime
meetingUrl
status
sequenceNumber
```

Status:

```text
SCHEDULED
IN_PROGRESS
COMPLETED
CANCELLED
MISSED
```

Session khác TutorAvailability.

---

# 41. Attendance

## Task L16

```text
Attendance
--------------------
id
sessionId
userId
present
checkinAt
type
```

---

# 42. Assignment và Submission

## Task L17

Assignment:

```text
Assignment
--------------------
id
classroomId
title
description
content
dueDate
createdAt
```

Submission:

```text
Submission
--------------------
id
assignmentId
studentId
content
fileUrls
score
feedback
submittedAt
```

---

# 43. Review

## Task L18

```text
Review
--------------------
id
reviewerId
revieweeId
classroomId
rating
comment
createdAt
```

Chỉ review khi user có relationship hợp lệ với class/contract.

---

# 44. Contract Service

Contract Service quản lý financial + contract domain.

## 44.1 Trách nhiệm

- Contract
- Contract lifecycle
- Payment
- Payment idempotency
- Wallet
- Wallet ledger
- Escrow
- Escrow release
- Blockchain contract hash
- Outbox

---

# 45. Contract Service Structure

```text
contract-service/
└── src/main/java/.../
    ├── modules/
    │   ├── contract/
    │   │   └── state/
    │   ├── payment/
    │   ├── wallet/
    │   ├── escrow/
    │   └── blockchain/
    │
    ├── infrastructure/
    │   ├── messaging/
    │   ├── paymentgateway/
    │   ├── blockchain/
    │   └── persistence/
    │       └── outbox/
    │
    └── shared/
```

Không tách Payment/Wallet/Escrow thành service riêng.

---

# 46. Contract

## Task C1

```text
Contract
--------------------
id
studentId
tutorId
classroomId
totalAmount
numberOfSessions
pricePerSession
status
documentUrl
contractHash
blockchainTxHash
blockchainNetwork
createdAt
activatedAt
completedAt
```

---

# 47. Contract Lifecycle

## Task C2

```text
DRAFT
↓
PENDING_SIGNATURE
↓
PENDING_PAYMENT
↓
ACTIVE
↓
COMPLETED
```

Optional:

```text
CANCELLED
DISPUTED
```

Không cho transition tùy ý.

Ví dụ:

```text
DRAFT -> COMPLETED
```

phải reject.

Tạo centralized transition logic.

Có thể dùng State Pattern hoặc state transition service.

---

# 48. Blockchain Contract Hash

## Task C3

Flow:

```text
Contract
↓
Canonical Contract Data
↓
SHA-256
↓
contractHash
↓
Blockchain Adapter
↓
transactionHash
```

Không lưu toàn bộ contract/PDF lên blockchain.

Lưu:

```text
contractHash
transactionHash
network
confirmedAt
```

Verify API:

```text
GET /contracts/{id}/verify
```

Flow:

```text
Load current contract
↓
Generate canonical data
↓
Hash again
↓
Compare blockchain hash
↓
VALID / INVALID
```

---

# 49. Payment

## Task C4

```text
Payment
--------------------
id
contractId
studentId
amount
provider
providerTransactionId
idempotencyKey
status
createdAt
paidAt
```

Status:

```text
CREATED
PENDING
SUCCESS
FAILED
REFUNDED
CANCELLED
```

---

# 50. Payment Idempotency

## Task C5

Bắt buộc hỗ trợ:

```text
Idempotency-Key
```

Database:

```text
UNIQUE(idempotency_key)
```

Nếu user gọi create payment nhiều lần với cùng key:

```text
return existing payment
```

Không tạo payment mới.

---

# 51. Payment Callback Idempotency

## Task C6

Callback có thể đến nhiều lần.

Flow:

```text
Find payment
↓
Lock row
↓
Check status
```

Nếu:

```text
status != PENDING
```

thì:

```text
return already processed
```

Không:

- tạo escrow lần 2,
- release tiền lần 2,
- emit event lần 2.

---

# 52. Wallet

## Task C7

```text
Wallet
--------------------
id
userId
balance
version
createdAt
updatedAt
```

Không update balance mà không lưu transaction record.

---

# 53. WalletTransaction

## Task C8

```text
WalletTransaction
--------------------
id
walletId
type
amount
referenceType
referenceId
status
createdAt
```

Types:

```text
DEPOSIT
ESCROW_HOLD
ESCROW_RELEASE
REFUND
WITHDRAW
```

---

# 54. Escrow

## Task C9

```text
Escrow
--------------------
id
contractId
studentId
tutorId
totalAmount
heldAmount
releasedAmount
refundedAmount
status
createdAt
updatedAt
```

Status:

```text
CREATED
FUNDED
PARTIALLY_RELEASED
RELEASED
REFUNDED
DISPUTED
```

---

# 55. Escrow Flow

## Task C10

```text
Payment SUCCESS
↓
Create/Fund Escrow
↓
Contract ACTIVE
↓
Session Completed
↓
Release one session amount
↓
Tutor Wallet
```

Không release vượt totalAmount.

Không release cùng Session hai lần.

---

# 56. EscrowRelease

## Task C11

```text
EscrowRelease
--------------------
id
escrowId
sessionId
amount
status
createdAt
```

Constraint:

```text
UNIQUE(escrow_id, session_id)
```

để chống release một session nhiều lần.

---

# 57. Notification Service

## 57.1 Trách nhiệm

- Notification
- Email
- Chat
- WebSocket

Structure:

```text
notification-service/
└── modules/
    ├── notification/
    ├── email/
    ├── chat/
    └── websocket/
```

---

# 58. Notification

## Task N1

```text
Notification
--------------------
id
userId
type
title
message
read
createdAt
```

---

# 59. Chat

## Task N2

Entities:

```text
Conversation
ConversationParticipant
Message
```

WebSocket phải validate participant.

Không cho user join conversation không thuộc về mình.

---

# 60. Chat Security

## Task N3

Chỉ claim:

```text
HTTPS
WSS
JWT
Authorization
Participant Validation
```

Không gọi là E2EE nếu server vẫn đọc được plaintext.

---

# 61. REST và Message Broker

REST dùng cho request cần response ngay.

Ví dụ:

```text
Learning -> Account
GET Tutor Profile
```

RabbitMQ dùng cho cross-service asynchronous event.

Ví dụ:

```text
session.completed
payment.completed
contract.activated
escrow.released
notification.requested
```

Không dùng RabbitMQ thay REST cho mọi thứ.

---

# 62. RabbitMQ

## Task E1

Mọi event nên có:

```text
eventId
eventType
aggregateId
occurredAt
payload
```

Ví dụ:

```java
public record SessionCompletedEvent(
    UUID eventId,
    UUID sessionId,
    UUID classroomId,
    UUID contractId,
    UUID studentId,
    UUID tutorId,
    Instant occurredAt
) {}
```

---

# 63. Events ưu tiên

```text
tutor.approved

matching.completed
matching.accepted

contract.created
contract.activated

payment.completed
payment.failed

classroom.created

session.completed

escrow.released

notification.requested
```

---

# 64. Event Flow ví dụ

```text
Learning Service
      │
      │ session.completed
      ▼
   RabbitMQ
      │
      ├──────────────► Contract Service
      │                  release escrow
      │
      └──────────────► Notification Service
                         create notification
```

---

# 65. Outbox Pattern

## Task E2

Làm Outbox trước Saga.

Table:

```text
OutboxEvent
--------------------
id
aggregateId
eventType
payload
status
retryCount
createdAt
publishedAt
```

Flow:

```text
@Transactional
    business DB update
    +
    insert outbox_event
COMMIT
```

Sau đó:

```text
Outbox Publisher
↓
RabbitMQ
↓
mark PUBLISHED
```

Nếu publish fail:

```text
retry
```

---

# 66. Consumer Idempotency

## Task E3

Consumer phải chống xử lý event lặp.

Có thể tạo:

```text
ProcessedEvent
--------------------
eventId
consumerName
processedAt
```

Constraint:

```text
UNIQUE(eventId, consumerName)
```

---

# 67. Saga Pattern

Không làm Saga trước core flow.

Chỉ làm khi:

- service boundaries ổn,
- RabbitMQ ổn,
- Outbox ổn,
- workflow thực sự distributed.

Possible Saga:

```text
Match Accepted
↓
Create Contract
↓
Create Classroom
↓
Create Enrollment
↓
Create Escrow
↓
Complete
```

Compensation:

```text
Escrow creation failed
↓
Cancel Enrollment
↓
Cancel Classroom
↓
Cancel Contract
```

---

# 68. Database Ownership

Mỗi service có logical ownership riêng.

Recommended:

```text
account_db
learning_db
contract_db
notification_db
```

Hoặc cùng PostgreSQL server nhưng schema riêng:

```text
account_schema
learning_schema
contract_schema
notification_schema
```

Không truy cập repository của service khác.

Sai:

```text
Learning Service
↓
Account UserRepository
```

Đúng:

```text
Learning Service
↓ REST
Account Service
```

hoặc:

```text
Event
↓
Local Read Model
```

---

# 69. Security

Bắt buộc:

```text
JWT
RBAC
BCrypt
HTTPS
WSS
Input Validation
Rate Limiting
Secure Headers
Resource Ownership
File Validation
```

Role authorization chưa đủ.

Ví dụ Tutor A không được sửa Tutor B availability.

Ngoài:

```java
@PreAuthorize("hasRole('TUTOR')")
```

phải check:

```text
resource.tutorId == authenticatedUserId
```

---

# 70. Exception Handling

Mỗi service cần Global Exception Handler.

Chuẩn hóa response lỗi:

```json
{
  "timestamp": "...",
  "status": 409,
  "code": "AVAILABILITY_IN_USE",
  "message": "...",
  "path": "..."
}
```

Không throw raw exception trực tiếp cho client.

---

# 71. Validation

DTO phải validate:

- required field,
- email,
- length,
- date/time,
- budget,
- amount,
- enum,
- file type,
- file size.

Không tin dữ liệu frontend.

---

# 72. Testing

Các business rule quan trọng phải có test.

Ưu tiên:

- register mặc định STUDENT,
- tutor approved thêm TUTOR nhưng không mất STUDENT,
- login mặc định activeRole STUDENT,
- availability conflict,
- invalid contract state transition,
- payment idempotency,
- callback idempotency,
- escrow release idempotency,
- ownership authorization,
- outbox publisher retry.

---

# 73. Docker

Root nên có:

```text
docker-compose.yml
```

Có thể quản lý:

```text
PostgreSQL
RabbitMQ
Redis
Account Service
Learning Service
Contract Service
Notification Service
API Gateway
```

Không thêm Kubernetes nếu chưa có yêu cầu.

---

# 74. Thứ tự triển khai bắt buộc

AI Coding Assistant phải làm từng phase.

Không nhảy phase.

---

# PHASE 1 — Architecture Refactor

## Task 1.1

Gộp `auth-service` vào `account-service`.

Yêu cầu:

- không làm mất business logic,
- giữ API tương thích nếu có thể,
- sửa package/import,
- build thành công.

## Task 1.2

Refactor Account:

```text
auth
user
role
profile
tutor
staff
```

## Task 1.3

Refactor:

```text
User
Role
UserRole
```

Rule:

```text
Register -> STUDENT
```

## Task 1.4

Xóa dependency persistent `currentRole`.

Login response:

```text
activeRole = STUDENT
```

---

# PHASE 2 — Tutor Upgrade

## Task 2.1

Implement `TutorApplication`.

## Task 2.2

Implement `Certificate`.

## Task 2.3

Admin approve/reject.

## Task 2.4

Approve:

```text
Add TUTOR role
```

Không xóa STUDENT.

---

# PHASE 3 — Learning Cleanup

## Task 3.1

Di chuyển Student/Tutor profile khỏi Learning nếu duplicate.

## Task 3.2

Create:

```text
TutorTeachingProfile
```

## Task 3.3

Refactor:

```text
Schedule -> TutorAvailability
```

## Task 3.4

Implement:

```text
AVAILABILITY_IN_USE
```

---

# PHASE 4 — Core Learning Flow

Implement tuần tự:

```text
Subject
↓
LearningRequest
↓
Matching
↓
Classroom
↓
Enrollment
↓
Session
↓
Attendance
↓
Assignment
↓
Submission
↓
Review
```

Mỗi task cần:

- entity,
- repository,
- service,
- controller,
- DTO,
- validation,
- exception handling,
- migration,
- test.

---

# PHASE 5 — Recommendation V1

## Task 5.1

Rule-Based Filtering.

## Task 5.2

Content-Based Filtering.

## Task 5.3

Return ranked TutorRecommendation list.

---

# PHASE 6 — Interaction Tracking

Implement:

```text
MatchingInteraction
```

Track:

```text
VIEW
CLICK
CONTACT
ACCEPT
REJECT
ENROLL
REVIEW
```

---

# PHASE 7 — Contract

Implement:

```text
Contract
Contract lifecycle
Contract state validation
```

---

# PHASE 8 — Payment

Implement:

```text
Payment
Payment Gateway
Idempotency-Key
Callback Idempotency
```

Không xử lý payment nhiều lần.

---

# PHASE 9 — Escrow

Implement:

```text
Wallet
WalletTransaction
Escrow
EscrowRelease
```

Flow:

```text
payment.completed
↓
escrow funded
↓
session.completed
↓
partial release
↓
Tutor wallet
```

---

# PHASE 10 — RabbitMQ

Ưu tiên:

```text
payment.completed
session.completed
escrow.released
notification.requested
```

---

# PHASE 11 — Outbox

Implement:

```text
OutboxEvent
OutboxPublisher
Retry
Consumer Idempotency
```

---

# PHASE 12 — Blockchain

Implement:

```text
Canonical Contract
↓
SHA-256
↓
Blockchain
↓
transactionHash
```

Implement verify.

---

# PHASE 13 — Collaborative Filtering

Chỉ làm sau khi interaction data đã có.

---

# PHASE 14 — Hybrid Recommendation

Combine:

```text
Business Rules
+
Content-Based
+
Collaborative Filtering
```

---

# PHASE 15 — Saga

Implement cuối cùng nếu workflow thực sự cần distributed compensation.

---

# 75. Quy tắc làm việc cho AI Coding Assistant

Mỗi lần nhận task:

1. Đọc code hiện tại trước.
2. Phân tích code đang có trước khi sửa.
3. Không viết lại toàn bộ project nếu không cần.
4. Không tự đổi kiến trúc.
5. Không tự tạo thêm microservice.
6. Không xóa business logic hiện tại nếu chưa xác minh.
7. Tái sử dụng code phù hợp.
8. Không sửa frontend nếu task chỉ yêu cầu backend.
9. Không implement phase sau nếu chưa được yêu cầu.
10. Sau mỗi task phải build/test.
11. Nếu có schema conflict hoặc dependency conflict, báo rõ.
12. Ưu tiên migration an toàn.
13. Không phá API cũ ngoài thay đổi đã thống nhất.

---

# 76. Format bắt buộc sau mỗi Task

AI phải trả:

```text
## Task completed

### Files created
- ...

### Files modified
- ...

### Files removed
- ...

### Database changes
- ...

### APIs added/changed
- ...

### Business rules implemented
- ...

### Tests
- ...

### Build result
- ...

### Remaining issues
- ...
```

---

# 77. Những việc AI KHÔNG được tự ý làm

```text
- tách Matching thành microservice
- tách Payment thành microservice
- tách Wallet thành microservice
- tách Chat thành microservice
- tách Auth trở lại thành service riêng
- thêm Kafka khi chưa được yêu cầu
- thêm Kubernetes
- thêm Saga trước Outbox
- gọi HTTPS/WSS là E2EE
- gọi logic là Collaborative Filtering nếu chưa có interaction data
- lưu full contract lên blockchain
- cho Learning truy cập Account database trực tiếp
- dùng frontend là nơi duy nhất enforce business rule
- thay Service-Based Architecture bằng Microservices Architecture
```

---

# 78. Definition of Done

Một task chỉ hoàn thành khi:

```text
Code compile
+
API hoạt động
+
Validation hoạt động
+
Authorization đúng
+
Database migration đúng
+
Exception handling đúng
+
Không phá business logic hiện tại
+
Không phá API ngoài thay đổi đã thống nhất
+
Test business rule quan trọng
+
Build thành công
```

---

# 79. Business Flow hoàn chỉnh

```text
                           REGISTER
                              │
                              ▼
                     ACCOUNT SERVICE
                              │
                     role = STUDENT
                              │
                              ▼
                           LOGIN
                              │
                    activeRole=STUDENT
                              │
          ┌───────────────────┴────────────────────┐
          │                                        │
          │ Student flow                           │ Tutor upgrade
          ▼                                        ▼
 Learning Request                         Tutor Application
          │                                        │
          │                                   Certificates
          │                                        │
          │                                    Admin Review
          │                                        │
          │                                     APPROVED
          │                                        │
          │                                   Add TUTOR role
          │                                        │
          │                               roles=[STUDENT,TUTOR]
          │                                        │
          │                               switch STUDENT/TUTOR
          │                                        │
          └──────────────────────┬─────────────────┘
                                 │
                                 ▼
                              Matching
                                 │
                      Hybrid Recommendation
                                 │
                                 ▼
                        Recommended Tutors
                                 │
                                 ▼
                          Match Accepted
                                 │
             ┌───────────────────┴─────────────────┐
             ▼                                     ▼
       Contract Service                      Learning Service
             │                                     │
       Create Contract                         Classroom
             │                                     │
       Contract Hash                          Enrollment
             │                                     │
         Blockchain                              Session
             │                                     │
          Payment                             Attendance
             │                                     │
          Escrow ◄──────── session.completed ──────┘
             │
             ▼
       Partial Release
             │
             ▼
        Tutor Wallet
             │
             ▼
           Review
```

---

# 80. Kiến trúc chính thức dùng trong báo cáo

Có thể dùng đoạn sau:

> EduConnect được xây dựng theo **Service-Based Architecture**, trong đó backend được phân chia thành các service lớn theo miền nghiệp vụ gồm Account Service, Learning Service, Contract Service và Notification Service, với API Gateway đóng vai trò điểm truy cập chung cho Web/Mobile Client. Mỗi service là một Spring Boot application quản lý một nhóm chức năng có tính liên kết nghiệp vụ cao. Các tác vụ đồng bộ giữa các service được xử lý thông qua REST API, trong khi các side-effect và workflow bất đồng bộ sử dụng Message Broker. Kiến trúc này giúp duy trì ranh giới nghiệp vụ rõ ràng, giảm coupling và vẫn tránh độ phức tạp không cần thiết của việc chia nhỏ toàn bộ hệ thống thành nhiều microservice.

---

# 81. Cách trả lời khi được hỏi vì sao là Service-Based Architecture

> Hệ thống không chia service theo từng entity hoặc từng chức năng nhỏ mà chia theo business capability. Ví dụ Learning Service quản lý toàn bộ lifecycle từ Learning Request, Matching, Classroom, Session đến Attendance và Assignment; Contract Service quản lý Contract, Payment, Wallet, Escrow và Blockchain. Vì vậy mỗi service có phạm vi nghiệp vụ tương đối lớn và cohesive. Em chọn Service-Based Architecture vì phù hợp quy mô hệ thống, giảm distributed complexity nhưng vẫn đảm bảo separation of concerns và khả năng mở rộng.

---

# 82. Pattern và Technology không phải kiến trúc chính

Kiến trúc chính:

```text
Service-Based Architecture
```

Các thành phần sau chỉ là pattern/cơ chế hỗ trợ:

```text
Strategy Pattern
State Pattern
Observer/Event Pattern
Saga Pattern
Outbox Pattern

JWT
RBAC
RabbitMQ
Blockchain
Escrow
Hybrid Recommendation
WebSocket
```

Không mô tả các pattern trên là kiến trúc chính.

---

# 83. Nguyên tắc ưu tiên cuối cùng

Ưu tiên:

```text
Correct Business Flow
>
Clear Service Boundaries
>
Data Ownership
>
Transaction Consistency
>
Security
>
Testing
>
AI Quality
>
Distributed Complexity
```

Không biến project thành microservices chỉ để có nhiều service.

Kiến trúc phải giữ:

```text
4 Business Services
+
1 API Gateway
```

cho đến khi có yêu cầu kiến trúc mới rõ ràng.

---

# 84. Prompt mẫu để giao từng task cho AI

Ví dụ:

```text
Đọc file EDUCONNECT_SPRING_BOOT_SERVICE_BASED_MASTER.md.

Hiện tại chỉ thực hiện PHASE 1 - Task 1.1.

Yêu cầu:
1. Đọc và phân tích toàn bộ code liên quan trước khi sửa.
2. Liệt kê các file, package, API và dependency bị ảnh hưởng.
3. Gộp auth-service vào account-service nhưng không làm mất business logic.
4. Không thực hiện Task 1.2 trở đi.
5. Không tự tạo thêm microservice.
6. Giữ Service-Based Architecture theo tài liệu.
7. Sau khi sửa phải build/test.
8. Báo kết quả theo format "Task completed" trong tài liệu.
```

Task tiếp theo:

```text
Đọc file EDUCONNECT_SPRING_BOOT_SERVICE_BASED_MASTER.md.

Tiếp tục PHASE 1 - Task 1.2.
Không làm các task khác.

Trước khi sửa:
- kiểm tra trạng thái code sau Task 1.1,
- xác nhận build hiện tại,
- phân tích dependency.

Sau khi sửa:
- build,
- test,
- báo file thay đổi,
- database change,
- API change,
- remaining issues.
```

---

# 85. Kết luận

Kiến trúc backend chính thức của EduConnect:

```text
                         API GATEWAY
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        Account Service  Learning Service  Contract Service
              │               │               │
              └───────────────┼───────────────┘
                              │
                              ▼
                     Notification Service
```

Trong đó:

```text
Account Service
=
Auth + User + Role + Profile + Tutor Application + Certificate + Admin

Learning Service
=
Subject + LearningRequest + TutorTeachingProfile + Availability
+ Matching + Classroom + Enrollment + Session
+ Attendance + Assignment + Submission + Review

Contract Service
=
Contract + Payment + Wallet + Escrow + Blockchain + Outbox

Notification Service
=
Notification + Email + Chat + WebSocket
```

Business rule quan trọng:

```text
Register
→ STUDENT

Tutor Approved
→ STUDENT + TUTOR

Login
→ activeRole = STUDENT

Switch Tutor
→ chỉ đổi UI/context

Logout/Login
→ activeRole = STUDENT
```

Đây là blueprint chính để tiếp tục hoàn thiện backend Spring Boot.
