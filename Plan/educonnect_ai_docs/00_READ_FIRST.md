# EDUCONNECT — AI READ FIRST

> File này là **entry point bắt buộc** cho mọi AI Coding Assistant trước khi sửa code.

## 1. Project là gì?

**EduConnect** là nền tảng kết nối **Student** và **Tutor** để:
- tìm gia sư / tìm nhu cầu học,
- đăng bài tìm học / mở lớp,
- đề xuất lớp học hoặc gia sư phù hợp,
- tạo lớp và quản lý quá trình học,
- tạo hợp đồng học,
- thanh toán và giữ tiền theo cơ chế escrow,
- giải ngân theo từng buổi học hoàn thành,
- xác thực tính toàn vẹn hợp đồng bằng blockchain,
- chat / notification / email.

Backend dùng **Spring Boot** và kiến trúc chính thức là:

# Service-Based Architecture

Không mô tả project là Microservices Architecture.

## 2. Kiến trúc backend chính thức

```text
backend/
├── api-gateway/
├── account-service/
├── learning-service/
├── contract-service/
├── notification-service/
├── docker-compose.yml
└── .env
```

### Account Service
Quản lý:
- Authentication / Authorization
- User
- Role / RBAC
- Profile
- TutorProfile
- TutorApplication
- Certificate
- Admin / Staff

### Learning Service
Quản lý:
- Subject / Level / Grade
- TutorTeachingProfile
- TutorAvailability
- LearningPost / LearningRequest
- ClassPost / Classroom
- Search / Filter
- Matching / Recommendation
- Enrollment / JoinRequest
- Session
- Attendance
- Assignment
- Submission
- Review

### Contract Service
Quản lý:
- Contract
- Contract lifecycle
- Contract signature state
- Payment
- Wallet
- WalletTransaction
- Escrow
- EscrowRelease
- Blockchain contract hash
- Outbox / financial events

### Notification Service
Quản lý:
- Notification
- Email
- Chat
- WebSocket

## 3. Cấu trúc package hiện tại

Hiện tại project đang dùng cấu trúc package **theo layer trong mỗi service**, ví dụ:

```text
account-service/src/main/java/iuh/fit/account_service/
├── client/
├── config/
├── controller/
├── dto/
├── entity/
├── enums/
├── exception/
├── messaging/
├── repository/
├── service/
├── util/
├── AccountServiceApplication.java
└── ServletInitializer.java
```

```text
learning-service/src/main/java/iuh/fit/learning_service/
├── config/
├── controller/
├── dto/
├── entity/
├── enums/
├── exception/
├── messaging/
├── repository/
├── service/
└── LearningServiceApplication.java
```

### Quy tắc
AI **không được tự ý đổi toàn bộ sang package-by-feature** nếu chưa được yêu cầu.

Nếu cần tổ chức tốt hơn:
- có thể tạo sub-package nhỏ bên trong các layer,
- nhưng phải giữ code hiện tại ổn định,
- không refactor hàng loạt chỉ vì "clean architecture".

## 4. Business roles

Các actor chính:
- Guest
- Student
- Tutor
- Staff
- Admin
- External Payment Gateway

Business rule quan trọng:
- User mới đăng ký mặc định là `STUDENT`.
- Student có thể nộp hồ sơ để trở thành Tutor.
- Khi được duyệt: user có cả `STUDENT` và `TUTOR`.
- Không xóa role STUDENT.
- Active role chủ yếu là UI/context, không phải nguồn authorization duy nhất.

## 5. Flow nghiệp vụ tổng quát

```text
Guest
  ↓ Register
Student
  ├─ tạo bài đăng tìm gia sư / nhu cầu học
  ├─ tìm kiếm lớp học / tutor
  ├─ nhận đề xuất AI
  ├─ gửi yêu cầu tham gia lớp hoặc chọn tutor
  └─ có thể đăng ký trở thành Tutor

Tutor
  ├─ khai báo môn dạy / cấp lớp / học phí / lịch rảnh
  ├─ tạo bài đăng mở lớp
  ├─ nhận yêu cầu học
  ├─ tạo hoặc xác nhận Classroom
  └─ ký hợp đồng với Student

Match / Join accepted
  ↓
Contract
  ↓
Hai bên xác nhận / ký
  ↓
Student thanh toán
  ↓
Escrow giữ tiền
  ↓
Classroom + Sessions
  ↓
Mỗi session COMPLETED và được xác nhận hợp lệ
  ↓
Release tiền của session đó
  ↓
Tutor Wallet
  ↓
Kết thúc toàn bộ sessions
  ↓
Contract COMPLETED
  ↓
Review
```

## 6. Những chức năng làm theo phase, KHÔNG làm tất cả ngay

### Làm trước
1. Account + Role + Tutor upgrade
2. Subject / Level / Grade master data
3. Tutor teaching information + availability
4. Learning post / class post
5. Search + filter
6. Classroom / enrollment / session

### Làm sau
7. AI recommendation
8. Contract
9. Payment
10. Escrow release theo buổi
11. RabbitMQ + Outbox
12. Blockchain contract hash
13. Collaborative / Hybrid Recommendation
14. Saga nếu thật sự cần

## 7. Quy tắc bắt buộc cho AI Coding Assistant

Trước khi code:
1. Đọc `00_READ_FIRST.md`.
2. Đọc file domain liên quan task.
3. Scan code hiện tại.
4. Xác định entity/API/database đang tồn tại.
5. Không tự viết lại project.

Trong lúc code:
- Không tạo service mới nếu chưa được yêu cầu.
- Không duplicate User/Profile giữa service.
- Không truy cập database/repository của service khác.
- Đồng bộ cần response: REST.
- Async side-effect: RabbitMQ khi phase đó được bật.
- Business rule phải nằm ở backend.
- Có validation, exception handling, authorization ownership.

Sau khi code:
- build,
- test,
- liệt kê file thay đổi,
- database migration,
- API thay đổi,
- vấn đề còn lại.

## 8. Thứ tự đọc tài liệu

```text
00_READ_FIRST.md
01_ARCHITECTURE_AND_BOUNDARIES.md
02_ACCOUNT_DOMAIN.md
03_LEARNING_SEARCH_POST_RECOMMENDATION.md
04_CLASSROOM_CONTRACT_PAYMENT_ESCROW_BLOCKCHAIN.md
05_IMPLEMENTATION_ROADMAP_AND_AI_RULES.md
```

## 9. Nguyên tắc quan trọng nhất

> Ưu tiên business flow đúng, service boundary rõ, data ownership đúng và transaction an toàn hơn việc thêm nhiều pattern hoặc công nghệ.
