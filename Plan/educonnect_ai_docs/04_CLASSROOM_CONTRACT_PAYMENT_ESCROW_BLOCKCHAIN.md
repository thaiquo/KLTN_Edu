# EDUCONNECT — CLASSROOM, CONTRACT, PAYMENT, ESCROW & BLOCKCHAIN

## 1. Classroom lifecycle

```text
DRAFT
  ↓
RECRUITING
  ↓
READY
  ↓
ACTIVE
  ↓
COMPLETED
```

Optional:
```text
CANCELLED
SUSPENDED
```

Classroom:

```text
Classroom
- id
- tutorId
- subjectId
- gradeId
- name
- description
- teachingMode
- location
- maxStudents
- startDate
- endDate
- status
- contractId/reference nếu business yêu cầu
```

## 2. Enrollment / JoinRequest

Nên tách yêu cầu tham gia khỏi enrollment thật.

```text
JoinRequest
- id
- classroomId/classPostId
- studentId
- status
- createdAt
```

Status:
```text
PENDING
ACCEPTED
REJECTED
CANCELLED
```

Sau `ACCEPTED` và đủ điều kiện hợp đồng/thanh toán:
```text
Enrollment
- id
- classroomId
- studentId
- status
- joinedAt
```

## 3. Session

```text
Session
- id
- classroomId
- sequenceNumber
- date
- startTime
- endTime
- meetingUrl
- status
- completedAt
```

Status:
```text
SCHEDULED
IN_PROGRESS
COMPLETED
CANCELLED
MISSED
```

## 4. Contract nên được tạo khi nào?

Không tạo contract ngay khi Student chỉ "xem" hoặc "search".

Tạo khi:
- Student + Tutor đã thống nhất học,
- hoặc JoinRequest đã được chấp nhận,
- các điều khoản cơ bản đã xác định.

Flow:

```text
Match / JoinRequest ACCEPTED
  ↓
Create Contract DRAFT
  ↓
Generate contract terms
  ↓
Student confirm/sign
  ↓
Tutor confirm/sign
  ↓
PENDING_PAYMENT
```

## 5. Contract model

```text
Contract
- id
- studentId
- tutorId
- classroomId
- totalAmount
- numberOfSessions
- pricePerSession
- status
- documentUrl
- contractHash
- blockchainTxHash
- blockchainNetwork
- createdAt
- activatedAt
- completedAt
```

Lifecycle:

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

Không cho state jump tùy ý.

## 6. Blockchain — mục đích đúng

Blockchain **không dùng để lưu toàn bộ PDF hoặc business data**.

Mục đích:
- chứng minh contract content không bị sửa,
- tạo bằng chứng hash có timestamp/transaction.

Flow:

```text
Contract canonical data
  ↓
SHA-256
  ↓
contractHash
  ↓
Blockchain adapter
  ↓
txHash
```

Lưu DB:
```text
contractHash
blockchainTxHash
blockchainNetwork
confirmedAt
```

Verify:
```text
GET /contracts/{id}/verify
```

Flow:
```text
Load contract
  ↓
Canonicalize
  ↓
Hash lại
  ↓
Compare with stored/on-chain hash
  ↓
VALID / INVALID
```

### Thời điểm blockchain
Làm **sau** khi:
- contract lifecycle ổn,
- canonical contract format ổn,
- payment flow ổn cơ bản.

Không ưu tiên blockchain trước core business.

## 7. Payment

```text
Payment
- id
- contractId
- studentId
- amount
- provider
- providerTransactionId
- idempotencyKey
- status
- createdAt
- paidAt
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

## 8. Chống bấm thanh toán nhiều lần

Client gửi:

```text
Idempotency-Key: <unique-key>
```

DB:
```text
UNIQUE(idempotency_key)
```

Nếu cùng key:
```text
return existing payment
```

Không tạo transaction mới.

## 9. Callback payment bị gửi nhiều lần

Callback gateway phải idempotent.

```text
Find payment
  ↓
Lock payment row
  ↓
Verify provider signature
  ↓
If status already final
    -> return already processed
  ↓
Update payment SUCCESS/FAILED
```

Không được:
- fund escrow 2 lần,
- active contract 2 lần,
- emit event 2 lần.

## 10. Escrow

Student không trả thẳng toàn bộ tiền cho Tutor ngay.

```text
Payment SUCCESS
  ↓
Escrow FUNDED
  ↓
Contract ACTIVE
```

Escrow:

```text
Escrow
- id
- contractId
- studentId
- tutorId
- totalAmount
- heldAmount
- releasedAmount
- refundedAmount
- status
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

## 11. Giải ngân theo từng buổi học

Đây là flow mục tiêu:

```text
Session #1 COMPLETED
  ↓
Validate session belongs to active contract
  ↓
Validate no dispute / cancellation blocking release
  ↓
Calculate release amount
  ↓
Create EscrowRelease(sessionId)
  ↓
Move ledger:
Escrow hold -> Tutor Wallet
  ↓
Escrow PARTIALLY_RELEASED
```

Lặp cho từng session.

Khi session cuối hoàn tất:
```text
releasedAmount == totalAmount
  ↓
Escrow RELEASED
  ↓
Contract COMPLETED
```

## 12. Chống giải ngân một buổi nhiều lần

```text
EscrowRelease
- id
- escrowId
- sessionId
- amount
- status
- createdAt
```

Constraint:
```text
UNIQUE(escrow_id, session_id)
```

Consumer xử lý `session.completed` cũng cần idempotent.

## 13. Khi nào một Session được tính COMPLETED?

Không nên chỉ dựa vào việc "đã qua giờ".

Có thể yêu cầu:
- tutor mark completed,
- attendance/check-in,
- student confirmation hoặc auto-confirm sau thời gian grace period,
- không có dispute,
- session không CANCELLED/MISSED.

V1 có thể đơn giản:
```text
Tutor marks COMPLETED
+ Student confirms
```

Sau này mở rộng:
```text
Tutor completed
  ↓
Student has X hours to dispute
  ↓
No dispute
  ↓
eligible_for_release
```

## 14. Wallet nên dùng ledger

```text
Wallet
- id
- userId
- balance
- version
```

```text
WalletTransaction
- id
- walletId
- type
- amount
- referenceType
- referenceId
- status
- createdAt
```

Types:
```text
DEPOSIT
ESCROW_HOLD
ESCROW_RELEASE
REFUND
WITHDRAW
```

Không update balance mà không có transaction record.

## 15. Event flow mục tiêu

```text
Learning Service
  |
  | session.completed
  v
RabbitMQ
  |
  +--> Contract Service
  |      release escrow
  |
  +--> Notification Service
         notify student/tutor
```

Contract Service có thể emit:
```text
escrow.released
```

## 16. Outbox trước Saga

Khi đã dùng RabbitMQ cho financial flow:
- implement Outbox Pattern,
- consumer idempotency,
- retry.

Sau đó mới cân nhắc Saga.

## 17. Dispute / Refund — phase sau

Nếu có tranh chấp:
```text
Session completed?
  ↓
Student disputes
  ↓
Escrow DISPUTED
  ↓
Stop auto release
  ↓
Staff/Admin resolution
  ├─ release to Tutor
  ├─ refund Student
  └─ partial split (nếu business cho phép)
```

Không cần implement dispute engine ngay ở phase đầu, nhưng thiết kế status phải không khóa đường mở rộng.
