# EduConnect — Tài liệu kiến trúc và workflow tổng hợp

> Bản đồng bộ với source ngày **2026-09-14**.  
> Tài liệu này là bản đọc liền mạch; khi cần trạng thái chi tiết, dùng [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Không dùng các tuyên bố “100%” cũ làm bằng chứng production readiness.

## 1. Bài toán và giải pháp

EduConnect kết nối Student–Tutor và quản lý toàn bộ chuỗi từ tìm kiếm, xét duyệt, lớp học, hợp đồng, ký quỹ đến payout/refund. Hệ thống kết hợp:

- xác thực/role và kiểm duyệt Tutor;
- marketplace lớp/gia sư;
- hợp đồng điện tử và chữ ký EIP-712;
- Smart Contract escrow dùng test USDC;
- buổi học, điểm danh độc lập, homework;
- settlement per Student và dispute có evidence;
- persistent notification/realtime;
- AI Matching là hướng phát triển, chưa có nghiệp vụ thật.

## 2. Kiến trúc

Kiến trúc chính thức: **Service-Based Architecture**.

```text
Web :5173 / Expo
        │ cookie HTTP + WebSocket
        ▼
API Gateway :8080
   ├─ Account :8081
   ├─ Learning :8082
   ├─ Contract :8083 ── Sepolia/S3/Gotenberg
   ├─ Notification + Chat :8084
   └─ AI skeleton :8085

PostgreSQL 16 | RabbitMQ 3.13 | Gotenberg 8
```

- REST cho request/response và một số internal integration.
- RabbitMQ cho các event Account/Learning/Notification đã nối.
- WebSocket cho account/learning invalidation, notification và chat push.
- PostgreSQL lưu business state; blockchain event xác nhận state tài chính.

## 3. Domain service

### Account Service

- Register, OTP verify/resend, login, refresh rotation, switch-role, logout, forgot/reset/change password.
- User/role/activeRole, Student/Tutor profile, wallet address.
- TutorApplication: `DRAFT → PENDING → APPROVED|REJECTED`; restricted Tutor vẫn sửa/nộp hồ sơ nhưng chỉ APPROVED dùng full teaching API.
- Avatar và Tutor identity document trên S3; Staff/Admin review.

### Learning Service

- Teaching catalog, Tutor subject registration/evidence/review, availability.
- Classroom, schedule, chapter, visibility/review, capacity.
- Enrollment: `PENDING → ACCEPTED → ENROLLED`; `ENROLLED` chỉ sau confirmed funding activation.
- Rolling ClassSession, independent SessionAttendance, meeting-link gate và homework.
- Startup/periodic scheduler và durable retry sang Contract.

### Contract Service

- Canonical terms snapshot/hash, agreement/acceptance, EIP-712 verify.
- DOCX bằng poi-tl; PDF bằng Gotenberg; artifact local/S3.
- Agreement registration, funding projection, escrow accounting.
- Durable blockchain transaction, receipt watcher, event cursor/processed event, outbox/recovery.
- Per-session settlement, dispute, evidence và Staff/Admin resolution.

### Notification Service

- Notification database, unread/list/read APIs, Rabbit consumers và `/ws/notifications`.
- Chat conversation/message database, participant authorization, REST và `/ws/chat`.
- Web Bell dùng API thật; Web Messages hiện còn mock nên chat chưa hoàn chỉnh end-to-end.

### AI Service

- Chỉ có service skeleton, Gateway route và health endpoint.
- Chưa có Qdrant, Spring AI, embedding, semantic search, recommendation hoặc chatbot.

## 4. Workflow Account/Tutor approval

1. User đăng ký và xác minh OTP.
2. Login cấp access/refresh HttpOnly cookies.
3. Tutor mới có application `DRAFT`.
4. Tutor tải CCCD hai mặt hoặc passport, cập nhật và submit → `PENDING`.
5. Staff/Admin approve/reject.
6. Chỉ `APPROVED` có full Tutor authority; event cập nhật projection ở Learning.

## 5. Workflow lớp và enrollment

1. Approved Tutor đăng ký chuyên môn và tạo classroom/lịch/chapter.
2. Lớp được review/publish; Guest/Student tìm kiếm bằng filter thường.
3. Student gửi enrollment request; Tutor accept giữ chỗ.
4. Contract được tạo cho đúng Student–Tutor–classroom.
5. Chỉ sau `AgreementFunded` confirmed, Contract gọi Learning chuyển request thành `ENROLLED` và tạo attendance rows cần thiết.

## 6. Workflow hợp đồng/ký quỹ

1. Contract Service snapshot điều khoản thành canonical JSON và Keccak-256 `termsHash`.
2. Tutor và Student ký cùng typed data `ClassContract` qua MetaMask; backend recover signer và đối chiếu ví.
3. Khi đủ chữ ký, backend queue registration on-chain và sinh DOCX/PDF artifact.
4. `AgreementRegistered` confirmed → `WAITING_PAYMENT`.
5. Student gọi USDC `approve`, sau đó bắt buộc gọi escrow `fundAgreement(bytes32)`.
6. `AgreementFunded` confirmed → local `ACTIVE`, escrow `LOCKED`, Learning `ENROLLED`.

Không tồn tại fallback chuyển USDC trực tiếp vào escrow. Raw transfer là lỗi nghiêm trọng vì token không gắn agreement.

## 7. Workflow session/attendance

1. Scheduler sinh session cuốn chiếu theo classroom schedule.
2. Tutor cập nhật classroom meeting link khi cần; các buổi đọc link mới.
3. Trong đúng khung giờ, Tutor tự “vào dạy”, từng Student tự “vào học”. Tutor không điểm danh hộ.
4. Student chỉ lấy meeting link và nội dung/file bài tập sau check-in.
5. Hết giờ, scheduler chốt:
   - cả hai có mặt: `BOTH_PRESENT`;
   - Tutor có mặt, Student vắng: `STUDENT_ABSENT_TUTOR_PRESENT`;
   - Tutor vắng: `TUTOR_ABSENT`, kể cả cả hai vắng.
6. Delivery worker gửi outcomes sang Contract và chỉ đánh dấu dispatched khi Contract acknowledge.

## 8. Workflow settlement

Mỗi Student có agreement riêng; tiền không gom theo lớp.

| Kết quả | Tutor | Platform | Student |
| --- | ---: | ---: | ---: |
| `BOTH_PRESENT` | 85% | 15% | 0% |
| `STUDENT_ABSENT_TUTOR_PRESENT` | 45% | 10% | hoàn 45% |
| `TUTOR_ABSENT` | 0% | 0% | hoàn 100% |

1. Backend queue `proposeSessionSettlement` cho từng agreement.
2. Confirmed proposal mở dispute deadline 24 giờ.
3. Không dispute: scheduler queue `finalizeSession` sau deadline.
4. `SessionSettled` confirmed mới ghi exact payout/refund, tx hash, terminal status và notification.

## 9. Workflow dispute

1. Student/Tutor thuộc agreement mở complaint trong proposal window; V1 chỉ `BOTH_PRESENT`.
2. Reason text bắt buộc; file tùy chọn, tối đa 50 MB, hỗ trợ ảnh/video/audio/tài liệu.
3. File lưu S3 theo agreement/session/role; DB lưu key/media type/SHA-256.
4. Khi dispute được xác nhận, chỉ settlement đó bị giữ.
5. Student-origin complaint được Tutor nhìn thấy và phản hồi trong 24 giờ.
6. Staff đúng reviewer/Admin xem hai phía. Có thể resolve khi Tutor phản hồi hoặc khi response deadline hết.
7. Không có hạn cuối arbitration; tiền giữ cho tới confirmed resolution.
8. Approve hoàn 100% Student; reject trả 85/15.

Student không xem Tutor-origin complaint hoặc Tutor-private response/evidence.

## 10. Security

- JWT stateless; browser access/refresh token trong HttpOnly cookie.
- Refresh token raw không lưu DB; DB lưu SHA-256 session hash và rotation/revocation state.
- CSRF token cookie + `X-XSRF-TOKEN` cho mutating request.
- Protected service tự validate cookie JWT; Gateway không phải nguồn danh tính.
- Contract authorization dùng `userId/email/activeRole/roles` từ signed token, không tin query/header identity từ browser.
- Staff scope theo reviewer; evidence stream sau object-level authorization và `nosniff`.
- Không commit JWT/AWS/RPC/private key/keystore password.

## 11. Resilience

- Idempotent transaction intent và processed blockchain event.
- Pessimistic locking/one-sender queue để giảm nonce collision.
- Preflight `eth_call` trước ký/broadcast.
- Same-signed-bytes rebroadcast khi outcome chưa rõ; không tạo payout logic thứ hai.
- Bounded retry cho lỗi chắc chắn trước broadcast.
- Startup/periodic catch-up cho past-due session, pending delivery và expired proposal.
- Dispute không bị auto-finalize.

Không có “blockchain tự chạy” khi backend tắt. Sau restart, worker xử lý bù từ state PostgreSQL/on-chain.

## 12. Bằng chứng và giới hạn

Đã có Sepolia evidence:

- funding agreement đúng qua `fundAgreement`;
- payout 0.6 USDC thành 0.51 Tutor + 0.09 Platform;
- refund `TUTOR_ABSENT` 0.6 USDC về Student.

Giới hạn:

- Solidity V1 dispute chỉ `BOTH_PRESENT`;
- bốn legacy raw-transfer agreement bị cách ly;
- một operator instance, một primary RPC;
- Web chat chưa nối backend;
- AI chưa triển khai;
- Mobile chưa tương đương Web;
- violation/support ticket và reporting đầy đủ chưa có.

## 13. Tài liệu chi tiết

- [PROJECT.md](PROJECT.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- [BUSINESS_RULES.md](BUSINESS_RULES.md)
- [AUTH_SECURITY.md](AUTH_SECURITY.md)
- [API.md](API.md)
- [BLOCKCHAIN.md](BLOCKCHAIN.md)
- [AI_MATCHING.md](AI_MATCHING.md)
- [session/EDUCONNECT_SESSION_IMPLEMENTATION_STATUS.md](session/EDUCONNECT_SESSION_IMPLEMENTATION_STATUS.md)
