# EduConnect — Service-Based và Event-Driven Architecture

> Trạng thái: baseline được xác nhận, đối chiếu source ngày **2026-09-14**.  
> Bản tổng quát: [../ARCHITECTURE.md](../ARCHITECTURE.md).

## 1. Quyết định kiến trúc

EduConnect dùng **Service-Based Architecture** với sáu backend service theo macro business domain. Hệ thống chọn event-driven có chọn lọc; không mặc định mọi giao tiếp phải asynchronous và không gọi các skeleton/planned pattern là đã triển khai.

## 2. Service boundaries

| Service | Owner | Communication hiện có | Storage hiện có |
| --- | --- | --- | --- |
| Account | Identity/profile/Tutor application | REST, Feign, RabbitMQ, account WebSocket | PostgreSQL, S3 |
| Learning | Catalog/class/enrollment/session | REST, RabbitMQ, learning WebSocket, signed internal REST tới Contract | PostgreSQL |
| Contract | Agreement/document/escrow/dispute | REST, internal REST, Web3 RPC/event polling, DB outbox | PostgreSQL, S3/local artifact |
| Notification | Notification + chat | REST, RabbitMQ consumer, notification/chat WebSocket | PostgreSQL |
| AI | Future AI boundary | Health REST only | Không có AI/vector storage |
| Gateway | Edge routing/CORS | HTTP/WebSocket reverse proxy | Không có domain DB |

Gateway không xác minh JWT thay cho downstream service. Account/Learning/Contract/Notification tự đọc cookie JWT và áp dụng authorization.

## 3. Khi nào dùng REST/event

- REST: command cần phản hồi ngay, query authoritative, auth, CRUD và internal handoff có acknowledgement.
- RabbitMQ: event Account/Learning ảnh hưởng người khác/Notification; consumer phải idempotent.
- PostgreSQL outbox: Contract audit và durable state quanh blockchain transaction; không đồng nghĩa mọi outbox event đều publish RabbitMQ.
- Blockchain log polling: nguồn xác nhận trạng thái tài chính.
- WebSocket: báo thay đổi cho client online; sau đó client refetch REST.

Không có bằng chứng cho một Saga framework tổng quát. Các flow dài hiện được điều phối bằng state machine, scheduler, internal REST, outbox/transaction records và confirmed events.

## 4. State/idempotency patterns đã dùng

- Contract agreement/settlement/dispute/transaction có enum state và transition checks.
- Blockchain intent có unique idempotency key, sender serialization và pessimistic lock.
- Blockchain event deduplicate theo chain/transaction/log identity.
- Notification consumer deduplicate theo event/recipient.
- Learning chỉ đặt `settlementDispatched=true` sau Contract acknowledgement; failure được retry.
- Funding/session terminal state chỉ đổi từ confirmed escrow event.

## 5. Security boundary

- Browser auth: HttpOnly access/refresh cookies; CSRF token/header; downstream validation.
- Internal Learning → Contract: signed short-lived service JWT/scope.
- Operator private key: encrypted keystore trong Contract runtime; Student/Tutor private key không đi qua server.
- Chat hiện **không có E2EE** trong source; message content lưu PostgreSQL. Không được ghi là end-to-end encrypted.
- TLS/rate limiting là yêu cầu deployment; source local Gateway không phải bằng chứng production TLS/rate-limit đã triển khai.

## 6. AI/Notification không được mô tả quá mức

- AI service chỉ là skeleton; chưa có Strategy recommendation, collaborative filtering, Qdrant, Redis hoặc event indexer.
- Notification Service có PostgreSQL persistence, không dùng Redis làm primary store.
- Chat backend có REST/WebSocket nhưng Web Portal chưa nối.

## 7. Reorg và financial confirmation

Contract event polling dùng confirmation depth cấu hình, cursor và processed-event uniqueness. Receipt success chỉ xác nhận transaction execution; business projection vẫn dựa vào decoded event từ đúng contract. Mọi payout/refund report phải dùng exact amount/hash/block từ confirmed event.

## 8. Guardrails

- Không truy cập chéo domain DB khi có thể dùng API/event.
- Không thêm service mới nếu chưa xác nhận.
- Không quảng bá planned pattern là implemented.
- Không dùng WebSocket làm source of truth.
- Không retry blockchain unknown outcome bằng transaction logic mới.
- Không đưa KYC, evidence, message hoặc PII vào public chain/event payload không cần thiết.
