# EduConnect Implementation Status

## 1. Status Definitions

- `IMPLEMENTED`: flow chính đã có implementation đủ bằng chứng.
- `PARTIAL`: đã có một phần implementation nhưng chưa hoàn chỉnh.
- `PLANNED`: thuộc target design và dự kiến triển khai sau.
- `NOT_IMPLEMENTED`: target có nhưng source hiện chưa có implementation.
- `KNOWN_CONFLICT`: implementation hiện tại có mâu thuẫn đã xác định.
- `NEEDS_VERIFICATION`: chưa đủ bằng chứng kết luận.

## 2. Service Status

| Service | Responsibility | Status | Notes |
|---|---|---|---|
| `api-gateway` | Spring Cloud Gateway route account-service, learning-service, and WebSocket paths. | IMPLEMENTED | Routes are configured in `backend/api-gateway/src/main/resources/application.properties`. No gateway JWT verification filter found. |
| `account-service` | Auth, JWT cookie, OTP, users, roles, student/tutor profile, tutor application, staff approval, admin user operations, S3 avatar/documents, RabbitMQ events. | IMPLEMENTED | Main source under `backend/account-service/src/main/java`. |
| `learning-service` | Subject/catalog, tutor subject registrations, availability, classes, schedules/chapters, enrollment requests, RabbitMQ integration. | PARTIAL | Core class/join/catalog flows exist; session/attendance/homework are not implemented. |
| `contract-service` | Contract agreement, escrow payment, settlement, dispute, blockchain transaction dispatch, Web3j read/write/event ingestion. | PARTIAL | Entities/workflows exist; REST controllers and inter-service business API were not found. |
| `notification-service` | Notification service shell. | PLANNED | Spring Boot app exists, but no domain/API/messaging/persistence found. |
| `eureka-server` | Listed in root Maven modules. | NEEDS_VERIFICATION | Directory contains only build output under `target/`; no active source/pom found in current scan. |
| `ai-service` | Target AI Matching service. | NOT_IMPLEMENTED | No module/source/config found. |

## 3. Use Case Implementation Status

| UC | Use Case | Backend | Web | Mobile | Overall | Notes |
|---|---|---|---|---|---|---|
| UC001 | Đăng ký | IMPLEMENTED | IMPLEMENTED | PARTIAL | PARTIAL | Backend/Web include OTP verification; mobile has basic register call but no full OTP flow. |
| UC002 | Đăng nhập | IMPLEMENTED | IMPLEMENTED | PARTIAL | IMPLEMENTED | Account login sets `access_token` cookie; mobile login is basic. |
| UC003 | Tra cứu | PARTIAL | IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL | Tutor/class public search exists; student post search not found. |
| UC004 | Quản lý yêu cầu tham gia lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Enrollment request send/cancel/list exists. |
| UC005 | Quản lý thông tin cá nhân | IMPLEMENTED | IMPLEMENTED | PARTIAL | IMPLEMENTED | Profile/password/avatar exist on Web/backend; mobile only restores user basic state. |
| UC006 | Quản lý hợp đồng | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Contract entities/workflows exist; no REST API found. |
| UC007 | Quản lý bài đăng tìm gia sư | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No backend entity/controller found. |
| UC008 | Quản lý tin nhắn | NOT_IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Web has mock/in-memory messaging UI; no backend persistence/API found. |
| UC009 | Xem thông tin lớp học | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Public class list/detail flow exists. |
| UC010 | Quản lý bài tập | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No homework/submission/grading source found. |
| UC011 | Quản lý thanh toán | PARTIAL | KNOWN_CONFLICT | NOT_IMPLEMENTED | KNOWN_CONFLICT | Escrow/payment data exists, but frontend ABI mismatch blocks reliable Web3 flow. |
| UC012 | Quản lý hồ sơ gia sư | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Tutor application/profile/documents are implemented. |
| UC013 | Quản lý yêu cầu tham gia lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Tutor accept/reject/list requests exists. |
| UC014 | Quản lý lịch rảnh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Tutor availability API/UI exists. |
| UC015 | Quản lý lớp học | PARTIAL | IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL | Class create/update/visibility exists; full learning lifecycle is incomplete. |
| UC016 | Quản lý buổi học | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No learning session/attendance API found. |
| UC017 | Quản lý bài tập | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No tutor homework/grading module found. |
| UC018 | Theo dõi thu nhập | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Settlement/payment data exists; no complete tutor income flow found. |
| UC019 | Kiểm duyệt nội dung | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Tutor approval, subject/class review exist; post moderation not found. |
| UC020 | Quản lý vi phạm | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No violation module found. |
| UC021 | Giám sát lớp học | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Admin/staff class review/management exists, not full monitoring. |
| UC022 | Xử lý khiếu nại | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Contract dispute workflow exists; no complete API/UI flow found. |
| UC023 | Hỗ trợ người dùng | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Admin/staff user management exists; no support ticket module found. |
| UC024 | Quản lý người dùng | IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | IMPLEMENTED | Admin/staff user APIs exist. |
| UC025 | Quản lý danh mục | IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | IMPLEMENTED | Admin teaching catalog APIs exist. |
| UC026 | Quản lý Blockchain | PARTIAL | KNOWN_CONFLICT | NOT_IMPLEMENTED | KNOWN_CONFLICT | Backend Web3j exists; frontend ABI mismatch and no public contract API found. |
| UC027 | Quản lý thanh toán | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Admin payment monitoring is not complete. |
| UC028 | Báo cáo thống kê | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Some dashboards/stats exist; no comprehensive reporting flow found. |

## 4. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Authentication | IMPLEMENTED | Account service login/register/OTP/password reset/logout; web CSRF-aware API client. |
| Student Profile | IMPLEMENTED | User profile and activate-student flows exist. |
| Tutor Profile | IMPLEMENTED | Tutor profile and public tutor APIs exist. |
| Tutor Registration | IMPLEMENTED | Tutor application, subjects and documents exist. |
| Tutor Approval | IMPLEMENTED | Staff tutor application approval/rejection exists. |
| Search | PARTIAL | Tutor/class search exists; AI ranking and student post search are missing. |
| Tutor Availability | IMPLEMENTED | API/UI exist. |
| Class | PARTIAL | Class recruitment and review exist; full learning lifecycle incomplete. |
| Join Request | IMPLEMENTED | Student request and tutor accept/reject/cancel flows exist. |
| Student Post | NOT_IMPLEMENTED | No source evidence found. |
| Messaging | PARTIAL | Web mock UI only; backend persistence/API not found. |
| Contract | PARTIAL | Contract-service entities/workflows exist; REST/API integration incomplete. |
| Session | NOT_IMPLEMENTED | Learning session source not found. |
| Attendance | NOT_IMPLEMENTED | Attendance source not found. |
| Homework | NOT_IMPLEMENTED | Homework/submission/grading source not found. |
| Payment | PARTIAL | Escrow payment entities/workflows exist; public flow incomplete. |
| Income | PARTIAL | Settlement data supports income concept; no complete tutor income API found. |
| Complaint | PARTIAL | Contract dispute workflow/evidence exists; full complaint module not found. |
| Notification | PLANNED | notification-service shell only. |
| AI Matching | NOT_IMPLEMENTED | No ai-service, Qdrant, Spring AI, embedding, or ranking implementation found. |
| Blockchain | PARTIAL | Solidity + Web3j implemented; frontend ABI conflict and Sepolia deployment evidence missing. |
| Escrow | PARTIAL | Smart Contract ERC-20 escrow implemented; application flow incomplete. |
| Settlement | PARTIAL | Smart Contract and backend workflow exist; learning-triggered E2E flow missing. |
| Refund | PARTIAL | Smart Contract and backend workflow exist; public API/UI incomplete. |
| Dispute | PARTIAL | Smart Contract and backend workflow exist; full API/UI incomplete. |
| Admin Management | IMPLEMENTED | User/catalog/class review APIs exist in part; reports/payment/blockchain admin are partial. |

## 5. Infrastructure Status

| Infrastructure | Status | Notes |
|---|---|---|
| PostgreSQL | IMPLEMENTED | Services use PostgreSQL `kltn_db` with separate Flyway history tables. |
| RabbitMQ | PARTIAL | Account/Learning events exist; Contract integration not wired via RabbitMQ. |
| S3 | IMPLEMENTED | Account-service implements avatar and tutor document storage. |
| Docker | PARTIAL | `docker-compose.yml` provides PostgreSQL and RabbitMQ only. |
| Qdrant | NOT_IMPLEMENTED | No container/config/source found. |
| Blockchain | PARTIAL | Foundry/Solidity/Anvil implemented; app integration partial. |
| Sepolia | PLANNED | Config exists; no Sepolia deployment evidence found. |

## 6. Known Conflicts

### Web3 ABI mismatch

Solidity source of truth:

- `blockchain/src/interfaces/IEduConnectEscrow.sol`
- `blockchain/src/EduConnectEscrow.sol`
- `agreementId` and `sessionId` are `bytes32`.
- `registerAgreement(bytes32,address,address,bytes32,uint256,uint256,uint32)`.
- Settlement uses `proposeSessionSettlement(...)` and `finalizeSession(...)`.
- Refund cancellation uses `cancelAgreementAndRefundUnused(bytes32,bytes32)`.

Frontend current ABI:

- `frontend-web/src/web3/web3Config.ts`
- Uses `uint256 agreementId`.
- Declares old/different functions such as `settleSessionProposal(...)`, `cancelAndRefundAgreement(uint256)`, and `getDispute(...)`.
- Event signatures also use `uint256` and old fields.

Status: `KNOWN_CONFLICT`. Frontend Web3 flow must not be treated as complete until ABI, addresses, and wrapper logic match Solidity.

### Web3 local address mismatch

Current frontend defaults in `frontend-web/src/web3/web3Config.ts` set Anvil `escrow` to `0x5Fb...` and `usdc` to `0xe7f...`. Phase 2 audit found Anvil deployment evidence with token at `0x5fb...` and escrow at `0xe7f...`.

Status: `KNOWN_CONFLICT`. Verify current deployment artifact before using Web3 UI.

### Security inconsistency

Account service `JwtAuthenticationFilter` reads JWT from HttpOnly cookie `access_token`. Learning service `CookieJwtAuthenticationFilter` checks `Authorization: Bearer` first, then cookies `access_token` or `token`.

Status: `KNOWN_CONFLICT`. Browser architecture should remain cookie-first; do not document the whole platform as Bearer-only.

## 7. Planned Major Work

- AI Matching service with hard filtering, content-based scoring, weighted scoring, semantic similarity, Qdrant and Spring AI.
- Student post / tutor-search post domain.
- Messaging backend persistence/API/realtime delivery.
- Learning sessions, attendance, homework, submission and grading.
- Contract REST API and Student/Tutor contract management flow.
- Payment/income APIs and admin payment management.
- End-to-end Learning session completed -> Contract settlement -> Blockchain flow.
- Notification service domain and delivery implementation.
- Mobile expansion beyond auth/home.
- Sepolia deployment evidence and environment documentation.
- Frontend ABI/address alignment with Solidity.

## 8. Update Rule

Update this file when implementation changes significantly, especially when a feature moves:

- `NOT_IMPLEMENTED` -> `PARTIAL`
- `PARTIAL` -> `IMPLEMENTED`
- `KNOWN_CONFLICT` -> resolved status

Do not modify `docs/BUSINESS_RULES.md` only because implementation status changes. Business target and current implementation are separate.
