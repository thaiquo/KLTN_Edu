# EDUCONNECT — ARCHITECTURE & SERVICE BOUNDARIES

## 1. Kiến trúc chính

EduConnect sử dụng **Service-Based Architecture**.

Mỗi service là một Spring Boot application tương đối lớn, được chia theo business capability, không chia nhỏ mỗi entity thành một microservice.

```text
Client
  ↓
API Gateway
  ├─ Account Service
  ├─ Learning Service
  ├─ Contract Service
  └─ Notification Service
```

## 2. API Gateway

Chỉ chịu trách nhiệm:
- routing,
- authentication filter,
- CORS,
- rate limiting,
- request logging,
- correlation ID.

Không chứa:
- business logic,
- entity/repository domain,
- payment logic,
- learning logic.

## 3. Data ownership

Mỗi service sở hữu dữ liệu domain của nó.

Khuyến nghị:
```text
account_db
learning_db
contract_db
notification_db
```

Hoặc cùng PostgreSQL server nhưng schema riêng.

### Cấm
```text
Learning Service -> Account UserRepository
Contract Service -> Learning SessionRepository
```

### Đúng
```text
Learning -> REST -> Account
Contract -> REST -> Learning
```

hoặc dùng event / local read model ở phase sau.

## 4. Giao tiếp service

### REST
Dùng khi cần response ngay:
- lấy profile tutor,
- kiểm tra tutor có active/verified,
- lấy thông tin classroom,
- validate quyền sở hữu.

### RabbitMQ
Dùng cho asynchronous events:
- `tutor.approved`
- `classroom.created`
- `session.completed`
- `payment.completed`
- `contract.activated`
- `escrow.released`
- `notification.requested`

Không dùng RabbitMQ thay cho mọi REST call.

## 5. Package convention hiện tại

Project đang dùng package theo layer:

```text
controller/
dto/
entity/
enums/
exception/
repository/
service/
config/
messaging/
client/
util/
```

Giữ convention này để AI không tự refactor lớn.

Có thể thêm sub-package khi domain lớn, ví dụ:

```text
service/
├── search/
├── matching/
├── classroom/
└── session/
```

nhưng chỉ khi cần.

## 6. Security

Bắt buộc:
- JWT
- RBAC
- BCrypt
- Input Validation
- Ownership Authorization
- HTTPS/WSS ở production
- Rate limiting tại gateway
- File type/size validation

Ví dụ role đúng nhưng ownership sai vẫn phải reject:

```text
Tutor A không được sửa availability của Tutor B.
Student A không được sửa learning post của Student B.
```

## 7. Exception format

Mỗi service nên chuẩn hóa lỗi:

```json
{
  "timestamp": "...",
  "status": 409,
  "code": "AVAILABILITY_IN_USE",
  "message": "...",
  "path": "..."
}
```

## 8. Không tự ý tạo thêm service

Không tạo riêng:
- auth-service
- search-service
- matching-service
- payment-service
- wallet-service
- blockchain-service
- chat-service
- session-service

trừ khi kiến trúc được thay đổi có chủ đích.

## 9. Definition of Done

Một task backend chỉ hoàn thành khi:
- compile,
- API chạy,
- validation đúng,
- authorization đúng,
- migration đúng,
- exception handling đúng,
- test business rule quan trọng,
- không phá API cũ ngoài thay đổi đã thống nhất.
