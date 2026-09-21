# EduConnect — Trạng thái triển khai

> Audit theo source, migration, test và bằng chứng runtime đến **2026-09-14**.  
> `IMPLEMENTED` chỉ dùng khi flow chính có đủ backend/persistence/security/client evidence; không đồng nghĩa production-ready tuyệt đối.

## 1. Định nghĩa

- `IMPLEMENTED`: flow chính trong phạm vi ghi chú đã có đủ bằng chứng.
- `PARTIAL`: đã có thành phần thật nhưng người dùng hoặc vận hành chưa đi hết flow.
- `SKELETON`: module chạy được nhưng chỉ có khung/health.
- `NOT_IMPLEMENTED`: chưa có implementation nghiệp vụ.
- `LIMITED`: đã chạy nhưng bị giới hạn bởi thiết kế/version/deployment.
- `NEEDS_VERIFICATION`: source có dấu hiệu nhưng chưa đủ bằng chứng end-to-end.

## 2. Tổng quan service

| Service | Trạng thái | Bằng chứng và giới hạn |
| --- | --- | --- |
| `api-gateway` | IMPLEMENTED | Route Account/Learning/Contract/Notification/Chat/AI và bốn WebSocket route; credentialed CORS. Gateway không phải identity authority. |
| `account-service` | IMPLEMENTED | Auth cookie JWT, OTP, refresh rotation/revocation, role/activeRole, profile, wallet, Tutor application/documents, Staff/Admin management, S3, mail, RabbitMQ. |
| `learning-service` | IMPLEMENTED | Catalog, Tutor registration/availability, classroom, enrollment, rolling session, attendance, meeting-link gate, homework và settlement delivery. |
| `contract-service` | IMPLEMENTED + LIMITED | Agreement/signing/document/funding/settlement/refund/dispute/evidence/transaction recovery chạy thật trên Sepolia; V1 dispute chỉ cho `BOTH_PRESENT`, legacy rows bị cách ly và ops còn giới hạn. |
| `notification-service` | IMPLEMENTED/PARTIAL | Notification persistence, REST, Rabbit consumer, WebSocket hoạt động cho event đã nối. Chat backend có persistence/API/WebSocket nhưng Web Messages chưa nối. |
| `ai-service` | SKELETON | Có Spring Boot module và `GET /api/ai/health`; chưa có matching/RAG/model/vector. |
| `frontend-web` | IMPLEMENTED/PARTIAL | Flow chính Account/Learning/Contract/Dispute/Wallet/Notification có dữ liệu thật; một số Portal dashboard/message vẫn chứa mock state. |
| `mobile-app` | PARTIAL | Login/register/home cơ bản; không có parity với Web. |

## 3. Trạng thái use case

| UC | Use case | Backend | Web | Mobile | Kết luận |
| --- | --- | --- | --- | --- | --- |
| UC001 | Đăng ký | IMPLEMENTED | IMPLEMENTED | PARTIAL | OTP email hoàn chỉnh trên Web. |
| UC002 | Đăng nhập | IMPLEMENTED | IMPLEMENTED | PARTIAL | Cookie access/refresh, refresh rotation và logout/revoke. |
| UC003 | Tra cứu | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Search/filter gia sư và lớp; chưa phải AI search. |
| UC004 | Student quản lý yêu cầu tham gia | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Gửi, xem, hủy. |
| UC005 | Student quản lý thông tin cá nhân | IMPLEMENTED | IMPLEMENTED | PARTIAL | Profile/avatar/password/wallet trên Web. |
| UC006 | Student/Tutor quản lý hợp đồng | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Snapshot, ký EIP-712, artifact, lifecycle, chấm dứt hợp đồng đơn phương (Student) & đề xuất hủy lớp (Tutor) kèm chữ ký số ví Web3. |
| UC007 | Bài đăng tìm gia sư | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | Chưa có domain/controller. |
| UC008 | Tin nhắn Student–Tutor | IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | Backend persistence/API/WebSocket có; Portal vẫn dùng mock/in-memory. |
| UC009 | Xem thông tin lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Marketplace/list/detail và lớp đã tham gia. |
| UC010 | Student quản lý bài tập | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Xem/nộp text/file; nội dung bị gate bằng điểm danh. |
| UC011 | Student thanh toán/ký quỹ | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | `approve` + `fundAgreement`; ACTIVE chỉ sau confirmed event. |
| UC012 | Tutor quản lý hồ sơ | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | DRAFT/PENDING/REJECTED/APPROVED và document flow. |
| UC013 | Tutor quản lý yêu cầu tham gia | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Accept/reject; ENROLLED sau funding confirm. |
| UC014 | Tutor quản lý lịch rảnh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | API/UI hiện có. |
| UC015 | Tutor quản lý lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Create/update/visibility/schedule/chapter/student capacity. |
| UC016 | Buổi học và điểm danh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Rolling sessions, điểm danh độc lập, auto-finalize, link gate. |
| UC017 | Tutor quản lý bài tập | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Chủ đề, đề/file, xem bài nộp/chấm. |
| UC018 | Tutor theo dõi thu nhập | IMPLEMENTED/PARTIAL | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | Wallet/settlement có số confirmed; chưa có báo cáo kế toán chuyên sâu. |
| UC019 | Staff kiểm duyệt nội dung | IMPLEMENTED/PARTIAL | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | Tutor, teaching registration, catalog suggestion và class review; không có post moderation vì UC007 chưa có. |
| UC020 | Quản lý vi phạm | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | Chưa có violation module. |
| UC021 | Giám sát lớp | PARTIAL | PARTIAL | NOT_IMPLEMENTED | Có class/contract/dispute view theo reviewer; chưa có monitoring tổng hợp hoàn chỉnh. |
| UC022 | Xử lý khiếu nại | IMPLEMENTED + LIMITED | IMPLEMENTED | NOT_IMPLEMENTED | Per-agreement, history, S3 evidence, Tutor response window, Staff/Admin arbitration; V1 chỉ `BOTH_PRESENT`. |
| UC023 | Hỗ trợ người dùng | PARTIAL | PARTIAL | NOT_IMPLEMENTED | Chưa có support-ticket domain riêng. |
| UC024 | Admin quản lý người dùng | IMPLEMENTED | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | List/detail/status hiện có. |
| UC025 | Admin quản lý danh mục | IMPLEMENTED | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | CRUD/import catalog hiện có. |
| UC026 | Admin quản lý blockchain | IMPLEMENTED/PARTIAL | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | Transaction/financial audit có; chưa có full operator observability/multi-RPC. |
| UC027 | Admin quản lý thanh toán | IMPLEMENTED/PARTIAL | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | Financial overview/settlement/transaction list có; chưa phải hệ kế toán đầy đủ. |
| UC028 | Báo cáo thống kê | PARTIAL | PARTIAL | NOT_IMPLEMENTED | Có dashboard/stats rời rạc, chưa có reporting suite. |

## 4. Trạng thái theo phân hệ

### Account và security

- IMPLEMENTED: register, verify/resend OTP, login, refresh, switch role, logout, forgot/reset password.
- IMPLEMENTED: short-lived `access_token` và rotating `refresh_token` trong HttpOnly cookie; CSRF double-submit cookie/header cho state-changing browser request.
- IMPLEMENTED: multi-role + `activeRole`; quyền Tutor đầy đủ chỉ khi Tutor/TutorApplication `APPROVED`.
- IMPLEMENTED: avatar, profile, password, wallet address, geography reference.
- IMPLEMENTED: Tutor identity evidence trên S3, SHA-256 và presigned access.

### Learning

- IMPLEMENTED: normalized teaching catalog, Tutor teaching registration, evidence và Staff/Admin review.
- IMPLEMENTED: availability, classroom/schedule/chapter, public marketplace, review/visibility, enrollment lifecycle.
- IMPLEMENTED: rolling session generation, startup/periodic catch-up, một attendance row trên mỗi Student đã enrol.
- IMPLEMENTED: Student/Tutor tự điểm danh; Tutor chỉ xem ai có/không có mặt và không thể đánh dấu hộ Student.
- IMPLEMENTED: meeting link nằm cấp classroom; Tutor cập nhật được và các buổi dùng giá trị mới. Student chỉ đọc được sau check-in.
- IMPLEMENTED: homework description/file bị ẩn trước check-in; submission dùng attendance-owned record.
- IMPLEMENTED: delivery worker retry các session `COMPLETED` có `settlementDispatched=false`.

### Contract, document và escrow

- IMPLEMENTED: canonical `terms_json`/`terms_hash`, hai chữ ký EIP-712 được backend recover/verify theo ví đã chốt.
- IMPLEMENTED: poi-tl sinh DOCX, Gotenberg chuyển PDF, local/S3 storage abstraction và artifact hash/status.
- IMPLEMENTED: durable backend blockchain pipeline, idempotency, locking, preflight, dispatch, receipt watch, event cursor/processed-event.
- IMPLEMENTED: funding confirmation, per-session proposal/finalization, cancellation/refund unused và expiration.
- IMPLEMENTED: luồng Chấm dứt hợp đồng & Đề xuất Hủy lớp học (Termination & Whole-Class Cancellation Flow): Flyway v12, v13; API `/api/contracts/terminations`; EIP-712 signature verification trên backend; phân tách giao diện theo vai trò (Học viên đơn phương hủy 1 hợp đồng trong `ContractDocumentModal`, Gia sư đề xuất hủy cả lớp trong `TutorClassManagement`); phân xử Admin/Staff (`APPROVE`, `RECOMMEND`, `RESPOND`, `REJECT`) tự động đóng băng buổi học và thanh lý Escrow on-chain hoàn cọc.
- IMPLEMENTED: settlement distribution amounts lưu từ event, wallet/audit timeline dùng thời điểm/hash confirmed.
- IMPLEMENTED: catch-up sau restart và bounded auto-retry cho lỗi chắc chắn trước broadcast.
- LIMITED: chỉ một operator instance và một RPC primary; unknown receipt/confirmed revert không tự retry mù.
- LIMITED: bốn agreement legacy raw-transfer được `legacy_excluded`, chỉ còn giá trị audit.

### Dispute

- IMPLEMENTED: Student hoặc Tutor mở đơn cho agreement của chính mình trong cửa sổ proposal 24 giờ.
- IMPLEMENTED: khi đơn hợp lệ được ghi nhận, settlement bị giữ và scheduler không finalize.
- IMPLEMENTED: text reason; file ảnh/video/audio/PDF/TXT/Word/Excel tối đa 50 MB; S3 object key + SHA-256 metadata.
- IMPLEMENTED: Student thấy đơn của mình; Tutor thấy Student-origin complaint; Staff theo reviewer và Admin thấy theo quyền.
- IMPLEMENTED: Tutor response/evidence là dữ liệu riêng cho Tutor/Staff/Admin; Student không đọc được.
- IMPLEMENTED: Tutor có 24 giờ từ `submittedAt`; Staff/Admin xử lý khi có phản hồi hoặc sau hạn; không có arbitration deadline tiếp theo.
- IMPLEMENTED: approve hoàn 100%; reject trả 85/15 cho đề xuất `BOTH_PRESENT`.
- LIMITED: Solidity V1 không mở dispute on-chain cho `STUDENT_ABSENT_TUTOR_PRESENT` hoặc `TUTOR_ABSENT`.

### Notification và chat

- IMPLEMENTED: Notification CRUD read state, unread count, mark one/all, recipient ownership, idempotent Rabbit consumer, `/ws/notifications`.
- IMPLEMENTED theo producer hiện có: Tutor application, teaching registration, subject request, class review, enrollment và một số contract/settlement/dispute notification gửi nội bộ.
- PARTIAL: chưa phải mọi session/homework action đều phát persistent notification; exact-item deep link/archive/delete chưa đầy đủ.
- IMPLEMENTED backend chat: conversation/message tables, participant authorization, unread marking, REST và `/ws/chat`.
- PARTIAL Web chat: API client tồn tại nhưng `MessagesView` vẫn nhận `INITIAL_CONVERSATIONS` và sinh phản hồi giả.

### AI

- SKELETON: module Maven/Spring Boot port 8085, Gateway route và health endpoint.
- NOT_IMPLEMENTED: hard-filter orchestration, scoring/ranking, embeddings, Qdrant, RAG, LLM/chatbot, eval/monitoring.

## 5. Bằng chứng Sepolia hiện tại

- Master escrow: `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`.
- Circle Sepolia test USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`.
- Funding thật đã được `AgreementFunded` ingest cho agreement hoạt động.
- Payout `BOTH_PRESENT` 0.6 USDC: 0.51 Tutor + 0.09 Platform, tx `0xd835b8ae250b20141feb32d26eb081ca1a0d532c9c6780b9622812c91990dc2`.
- Refund `TUTOR_ABSENT` 0.6 USDC cho Student, tx `0xf608981a95f001b0cc5bd338995bd2cb54cc4addcf35b15957e06536005a3ec1`.

Đây là bằng chứng cho các kịch bản cụ thể, không phải cam kết production SLA cho mọi điều kiện mạng.

## 6. Kiểm chứng gần nhất

- Contract Termination & EIP-712 Signature: 15 unit & integration tests (`TerminationServiceTest`, `TerminationFlowIntegrationTest`, `Eip712VerificationServiceTest`) pass 100% ngày 2026-09-21; Frontend TypeScript & Vite build pass trong 1.53s.
- Contract: 14 test scheduler/transaction restart-recovery đã pass ngày 2026-09-14.
- Learning: 12 test attendance + settlement delivery đã pass ngày 2026-09-14.
- Trước đó: 35 Solidity unit/fuzz/invariant test pass; isolated Anvil end-to-end pass; frontend TypeScript và Vite build pass theo escrow hardening report.
- Database runtime ngày 2026-09-14: mọi session `COMPLETED` đều đã `settlement_dispatched=true`; không có failed transaction hợp lệ/actionable; legacy failures được cách ly.

## 7. Việc còn lại ưu tiên

1. Nối Portal Messages vào chat API/WebSocket, bỏ mock conversation/reply.
2. Triển khai AI Matching thật hoặc giữ UI ở trạng thái “chưa sẵn sàng”, không quảng bá như đã dùng AI.
3. Hoàn thiện mobile theo các flow Web cần thiết.
4. Bổ sung violation/support ticket và reporting tổng hợp.
5. Tăng cường production ops: multi-RPC/failover, operator HA an toàn, metrics/alerting, backup/restore drill.
6. Nếu cần khiếu nại cho outcome ngoài `BOTH_PRESENT`, thiết kế/deploy Solidity version mới; không vá lệch backend với V1.

## 8. Nguyên tắc cập nhật

Khi source thay đổi, cập nhật file này dựa trên đủ bằng chứng: entity/migration + service + controller/security + client + test/runtime phù hợp. Không dùng UI mock, comment hoặc tên file làm bằng chứng duy nhất cho `IMPLEMENTED`.
