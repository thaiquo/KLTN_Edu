# EduConnect — Kiến trúc hiện tại

> Source audit: **2026-09-14**. Kiến trúc chính thức là **Service-Based Architecture** có tích hợp event-driven; không gọi là Microservices Architecture.

## 1. Sơ đồ tổng thể

```text
React/Vite Web ─┐
Expo Mobile ────┼─HTTP/cookie──> API Gateway :8080
MetaMask ───────┘                    │
                                    ├─ Account :8081 ── S3 / Email
                                    ├─ Learning :8082
                                    ├─ Contract :8083 ── Sepolia RPC / S3 / Gotenberg
                                    ├─ Notification + Chat :8084
                                    └─ AI skeleton :8085

Account/Learning/Notification <──RabbitMQ──> kltn.edu.events
Learning <──signed internal REST──> Contract
Contract <──poll/submit──> EduConnectEscrow trên Sepolia
Web <──raw WebSocket──> Account/Learning/Notification/Chat
Các business service ──JPA/Flyway──> PostgreSQL kltn_db
```

## 2. Service map và ownership

| Service | Domain owner | Thành phần chính | Mức hoàn thiện |
| --- | --- | --- | --- |
| `api-gateway` | Edge routing | Spring Cloud Gateway WebFlux, credentialed CORS, REST và WebSocket routes. | IMPLEMENTED |
| `account-service` | Identity/account | User, role, active role, refresh session, OTP, Student/Tutor profile, TutorApplication/TutorDocument, địa chỉ ví, email, S3. | IMPLEMENTED |
| `learning-service` | Learning marketplace | Catalog, TutorSubject/registration, availability, classroom/schedule/chapter, enrollment, rolling session, attendance, homework. | IMPLEMENTED cho flow chính Web |
| `contract-service` | Contract/payment/escrow | Agreement, acceptance, document artifact, payment, settlement, dispute/evidence, blockchain transaction/outbox/event cursor. | IMPLEMENTED cho flow chính; có giới hạn V1/ops |
| `notification-service` | Notification và chat | Notification persistence, Rabbit consumers, Bell REST/WebSocket, conversation/message persistence, chat REST/WebSocket. | Notification IMPLEMENTED theo event đã nối; Chat backend IMPLEMENTED, Web còn mock |
| `ai-service` | AI future boundary | Spring Boot health endpoint. | SKELETON; AI nghiệp vụ NOT_IMPLEMENTED |

Không tạo thêm service hoặc chuyển domain owner nếu chưa có quyết định kiến trúc mới.

## 3. Client

### Web

`frontend-web` dùng React/Vite, React Router, TanStack Query, Tailwind, ethers.js và Reown AppKit. Web là client chính và có màn hình theo năm actor.

`/payments` hiện redirect về `/student/wallet`; `MyWalletView` được dùng cho lịch sử escrow/wallet. Portal vẫn còn một số state/demo data, rõ nhất là Messages UI chưa nối API chat đã có.

### Mobile

`mobile-app` dùng Expo Router/React Native. Source hiện chỉ có login, register, auth context và home cơ bản; không suy diễn rằng Mobile có contract/session/dispute parity với Web.

## 4. Giao tiếp liên service

### REST

- Client thường đi qua Gateway.
- Account dùng OpenFeign để đọc một số dữ liệu subject/Tutor từ Learning.
- Learning gửi kết quả buổi học sang internal endpoint của Contract bằng JWT service token có scope `contract-settlement`.
- Contract gọi internal Learning activation/expiration endpoint khi event blockchain xác nhận trạng thái agreement.
- Contract gọi internal Learning termination cutoff endpoint khi phê duyệt chấm dứt hợp đồng hoặc hủy lớp để đóng băng lịch học.
- Contract gửi notification trực tiếp qua internal Notification API cho các sự kiện contract/settlement/dispute.

REST failure không được biến thành trạng thái tài chính giả. Các worker giữ cờ chưa giao thành công và thử lại với các flow có durable state tương ứng.

### RabbitMQ

Exchange hiện tại: `kltn.edu.events`.

- Account phát event lifecycle Tutor application/approval.
- Learning tiêu thụ projection Tutor authority và phát event enrollment, class review, subject/teaching registration.
- Notification tiêu thụ các event có đủ recipient id, lưu notification idempotent rồi đẩy WebSocket.

Contract transaction pipeline dùng PostgreSQL/outbox và blockchain event polling; không phụ thuộc RabbitMQ để xác nhận tiền.

### WebSocket

- `/ws/account`
- `/ws/learning`
- `/ws/notifications`
- `/ws/chat`

REST/database vẫn là nguồn dữ liệu authoritative; WebSocket dùng để báo thay đổi và kích hoạt refetch, không thay thế persistence.

## 5. Data architecture

Các service hiện dùng chung một PostgreSQL database vật lý `kltn_db`, nhưng mỗi service có entity/migration và bảng Flyway history riêng. Ownership logic vẫn phải theo service; không thêm truy cập chéo bảng của service khác khi có thể dùng API/event.

| Service | Số migration hiện thấy | Nhóm bảng tiêu biểu |
| --- | ---: | --- |
| Account | 13 | users, roles, refresh_sessions, OTP, students, tutors, tutor applications/documents. |
| Learning | 31 | catalog, registrations, class_rooms, schedules/chapters, enrollment_requests, class_sessions, session_attendances, learning_termination_stops. |
| Contract | 13 | contract_agreement/acceptance/artifact, escrow_payment, session_settlement, dispute/evidence, blockchain_transaction, processed_event/outbox/cursor, termination_cases/items. |
| Notification | 2 | notifications, conversations, chat_messages. |

## 6. Storage và document

- Account Service dùng S3 cho avatar và hồ sơ/tài liệu Tutor, trả presigned URL có thời hạn.
- Contract Service dùng abstraction `ContractArtifactStorage`: local cho dev hoặc S3. Root environment hiện chọn `s3`.
- Artifact hợp đồng: template DOCX + poi-tl render; Gotenberg/LibreOffice chuyển DOCX sang PDF; metadata/hash lưu database.
- Dispute evidence dùng cùng storage abstraction, key tách theo agreement/session/role, giới hạn 50 MB và lưu SHA-256.
- Không lưu file binary evidence trong bảng dispute.

## 7. Blockchain architecture

- Solidity `EduConnectEscrow` là nguồn ABI và quy tắc tiền.
- Browser chỉ ký EIP-712 và Student gọi ERC-20 `approve` + escrow `fundAgreement`.
- Các write sau funding (`REGISTER`, `PROPOSE`, `FINALIZE`, `OPEN_DISPUTE`, `RESOLVE`, `EXPIRE`, `CANCEL`) thuộc backend operator/arbitrator pipeline.
- Transaction intent có idempotency key, pessimistic locking, sender serialization, prepare/simulate, broadcast, receipt watch và event ingestion.
- Chỉ confirmed contract event chuyển domain state cuối và số tiền confirmed.
- Scheduler có catch-up sau restart; smart contract không tự chạy nếu backend operator tắt.

Chi tiết: [BLOCKCHAIN.md](BLOCKCHAIN.md).

## 8. Scheduling và phục hồi

| Worker | Chu kỳ mặc định | Vai trò |
| --- | ---: | --- |
| Learning lifecycle | startup + 60 giây | Chốt buổi quá giờ, sinh session cuốn chiếu. |
| Settlement delivery | initial 5 giây, mỗi 30 giây | Gửi các buổi `COMPLETED` chưa được Contract xác nhận. |
| Contract finalization | initial 30 giây, mỗi 60 giây | Queue proposal đã hết cửa sổ dispute. |
| Blockchain dispatcher | initial 5 giây, mỗi 5 giây | Gửi transaction intent hợp lệ. |
| Receipt watcher | initial 7 giây, mỗi 5 giây | Dò receipt, rebroadcast cùng signed transaction khi cần. |
| Recovery | 15/30 giây | Hòa giải trạng thái lỗi và retry lỗi trước broadcast có giới hạn. |

Nếu service tắt qua thời hạn, dữ liệu deadline/hàng đợi vẫn ở PostgreSQL và on-chain; khi mở lại sẽ catch up. Không thể tuyên bố giao dịch xảy ra đúng lúc deadline trong thời gian mọi worker đang tắt.

## 9. Hạ tầng local

`docker-compose.yml` chạy:

- PostgreSQL 16;
- RabbitMQ 3.13 Management;
- Gotenberg 8.

Application service được chạy bằng Maven/PowerShell script, chưa được container hóa đầy đủ. Root `.env` là cấu hình dùng chung; chỉ biến `VITE_*` được phép lộ cho browser. Không commit JWT secret, AWS secret, private key hoặc operator keystore password.

## 10. Giới hạn kiến trúc hiện tại

- Một blockchain operator instance; chưa có distributed signer coordination.
- Một RPC endpoint cấu hình chính; chưa có multi-RPC automatic failover.
- AI service mới là skeleton; chưa có Qdrant/Spring AI/model pipeline.
- Web chat chưa nối backend chat.
- Mobile chưa feature-complete.
- Reviewer notification phụ thuộc producer cung cấp recipient id đáng tin cậy.
- Không có Eureka runtime module có source; root Maven không dùng Eureka.
