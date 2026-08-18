# EDUCONNECT — IMPLEMENTATION ROADMAP & AI CODING RULES

## 1. Mục tiêu

AI phải triển khai theo phase, không tự nhảy sang AI/Blockchain/Saga khi core flow chưa ổn.

---

# PHASE 0 — Baseline audit

AI phải:
- scan tất cả service,
- xác định compile status,
- liệt kê entity hiện có,
- API hiện có,
- database/migration hiện có,
- dependency giữa service,
- TODO/dead code quan trọng.

Không sửa lớn trong bước audit.

---

# PHASE 1 — Account foundation

Làm:
- User
- Role
- UserRole
- Profile
- register/login
- JWT/RBAC
- ownership rules
- GlobalExceptionHandler

Business:
```text
register -> STUDENT
```

---

# PHASE 2 — Tutor upgrade

Làm:
- TutorApplication
- Certificate
- TutorProfile
- Admin/Staff review
- add TUTOR role khi approved

Business:
```text
STUDENT -> approved -> STUDENT + TUTOR
```

---

# PHASE 3 — Learning master data

Làm:
- Subject
- EducationLevel
- Grade
- SubjectGrade hoặc mapping tương đương
- admin CRUD/status

Tutor/Student chỉ chọn từ dữ liệu hợp lệ.

---

# PHASE 4 — Tutor teaching setup

Làm:
- TutorTeachingProfile
- TutorSubjectGrade
- TutorAvailability
- hourly rate
- teaching mode
- location

Không duplicate Account Profile.

---

# PHASE 5 — Post system

Làm:
- LearningPost của Student
- ClassPost của Tutor
- time slots
- status lifecycle
- ownership authorization
- pagination

Không làm AI recommendation ở phase này.

---

# PHASE 6 — Search & Filter V1

Làm:
- search class posts,
- search learning posts,
- filter subject/grade/price/mode/location/time,
- sort,
- pagination,
- database indexes.

Ưu tiên PostgreSQL + JPA Specification/Criteria.

Không thêm Elasticsearch nếu chưa có performance reason.

---

# PHASE 7 — Join / Offer flow

Làm:
- JoinRequest
- TutorOffer nếu business cần
- ACCEPT/REJECT
- chống duplicate request
- authorization

---

# PHASE 8 — Classroom core

Làm:
- Classroom
- Enrollment
- Session
- Attendance
- Assignment
- Submission
- Review

Classroom dùng status, không hard delete khi đã có nghiệp vụ phát sinh.

---

# PHASE 9 — Recommendation V1

Làm:
1. hard rule filtering,
2. content-based scoring,
3. ranking.

Không gọi Collaborative Filtering.

---

# PHASE 10 — Interaction tracking

Track:
- IMPRESSION
- VIEW
- CLICK
- SAVE
- CONTACT
- JOIN_REQUEST
- ACCEPT
- REJECT
- ENROLL
- COMPLETE_CLASS
- REVIEW

---

# PHASE 11 — Contract

Làm:
- Contract
- Contract state machine/transition service
- terms snapshot
- student/tutor confirmation/signature state

Không làm blockchain trước khi contract canonical data ổn.

---

# PHASE 12 — Payment

Làm:
- payment gateway adapter,
- Idempotency-Key,
- provider callback verification,
- row lock / transaction,
- duplicate callback handling.

---

# PHASE 13 — Escrow & per-session release

Làm:
- Wallet
- WalletTransaction
- Escrow
- EscrowRelease
- release by completed session
- unique escrow+session
- total amount guard

---

# PHASE 14 — RabbitMQ + Notification events

Ưu tiên:
```text
payment.completed
contract.activated
session.completed
escrow.released
notification.requested
```

---

# PHASE 15 — Outbox + consumer idempotency

Làm:
```text
OutboxEvent
ProcessedEvent
retry
publisher
consumer idempotency
```

Financial/event consistency phải ổn trước Saga.

---

# PHASE 16 — Blockchain

Làm:
- canonical contract,
- SHA-256,
- blockchain adapter,
- txHash,
- verify endpoint.

Không lưu full PDF lên blockchain.

---

# PHASE 17 — Collaborative Filtering

Chỉ làm khi interaction dataset đã đủ.

---

# PHASE 18 — Hybrid Recommendation

Kết hợp:
```text
Business Rules
+ Content-Based
+ Collaborative
```

---

# PHASE 19 — Saga (optional)

Chỉ dùng nếu flow distributed thực sự cần compensation.

Ví dụ:
```text
Match accepted
  ↓
Create contract
  ↓
Create classroom
  ↓
Create enrollment
  ↓
Create escrow/payment intent
```

Nếu fail giữa chừng mới cần compensation có tổ chức.

---

## 2. Quy tắc mỗi lần giao task cho AI

Prompt nên có:

```text
Đọc:
1. 00_READ_FIRST.md
2. file domain liên quan task
3. code hiện tại liên quan

Chỉ thực hiện PHASE X - Task Y.

Trước khi sửa:
- phân tích code hiện có,
- liệt kê file/API/entity bị ảnh hưởng,
- phát hiện conflict.

Trong khi sửa:
- không đổi kiến trúc,
- không tạo service mới,
- không xóa logic chưa xác minh,
- giữ package convention hiện tại,
- thêm validation/authorization/exception handling,
- migration an toàn.

Sau khi sửa:
- build,
- test,
- báo cáo thay đổi.

Không làm phase tiếp theo.
```

## 3. Format AI phải trả sau task

```text
## Task completed

### Summary
- ...

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

### Security/Authorization
- ...

### Tests
- ...

### Build result
- ...

### Remaining issues
- ...

### Next recommended task
- ...
```

## 4. Những việc AI không được tự ý làm

- đổi Service-Based thành Microservices,
- tách auth-service trở lại,
- tạo search-service/matching-service/payment-service,
- thêm Kafka,
- thêm Kubernetes,
- thêm Elasticsearch quá sớm,
- implement Hybrid trước interaction tracking,
- implement Blockchain trước Contract,
- implement Saga trước Outbox,
- truy cập DB service khác,
- hard delete financial/contract history,
- dùng frontend làm nơi enforce business rule,
- cho Session auto release tiền mà không có idempotency,
- gọi HTTPS/WSS là E2EE.

## 5. Cách yêu cầu AI triển khai Search

```text
Đọc 00_READ_FIRST.md, 03_LEARNING_SEARCH_POST_RECOMMENDATION.md
và code hiện tại của learning-service.

Chỉ implement Search & Filter V1 cho ClassPost.

Yêu cầu:
- dùng package convention hiện tại,
- query theo keyword, subject, grade, price, mode, location,
- pagination + sorting,
- chỉ trả ClassPost OPEN,
- thêm indexes nếu cần,
- không làm recommendation/AI,
- không thêm Elasticsearch,
- build/test sau khi hoàn thành.
```

## 6. Cách yêu cầu AI triển khai Recommendation V1

```text
Đọc 00_READ_FIRST.md và
03_LEARNING_SEARCH_POST_RECOMMENDATION.md.

Chỉ implement Recommendation V1:
1. hard filtering,
2. content-based scoring,
3. ranking.

Không implement collaborative filtering.
Không gọi external AI API nếu chưa cần.
Weights phải configurable.
Trả explainable score components để dễ debug.
```

## 7. Cách yêu cầu AI triển khai Contract + Blockchain sau này

```text
Đọc 00_READ_FIRST.md và
04_CLASSROOM_CONTRACT_PAYMENT_ESCROW_BLOCKCHAIN.md.

Hiện tại chỉ implement Contract lifecycle.
KHÔNG implement blockchain.

Yêu cầu:
- state transition validation,
- canonical terms snapshot design,
- student/tutor confirmation,
- test invalid transitions.
```

Sau khi Contract ổn mới giao:

```text
Implement blockchain contract-hash verification.
Không lưu full PDF on-chain.
Hash canonical contract data bằng SHA-256.
Lưu txHash/network/confirmedAt.
Có verify endpoint.
```

## 8. Cách yêu cầu AI triển khai giải ngân theo buổi

```text
Đọc 04_CLASSROOM_CONTRACT_PAYMENT_ESCROW_BLOCKCHAIN.md.

Chỉ implement EscrowRelease theo Session COMPLETED.

Yêu cầu:
- mỗi session chỉ release 1 lần,
- UNIQUE(escrow_id, session_id),
- không release vượt held/total amount,
- transaction + row locking khi cần,
- tạo WalletTransaction,
- idempotent khi event bị gửi lại,
- test duplicate session.completed,
- không implement Saga ở task này.
```
