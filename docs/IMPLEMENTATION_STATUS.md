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
| `api-gateway` | Spring Cloud Gateway route account-service, learning-service, notification-service, and WebSocket paths. | IMPLEMENTED | Routes are configured in `backend/api-gateway/src/main/resources/application.properties`. No gateway JWT verification filter found. |
| `account-service` | Auth, short-lived JWT cookie, refresh token rotation/session revocation, OTP, users, roles, student/tutor profile, tutor application, staff approval, admin user operations, S3 avatar/documents, RabbitMQ events. | IMPLEMENTED | Main source under `backend/account-service/src/main/java`. |
| `learning-service` | Subject/catalog, tutor subject registrations, availability, classes, schedules/chapters, enrollment requests, rolling weekly sessions, attendance, homework gating, and RabbitMQ/Contract integration. | IMPLEMENTED | Core class/join/catalog flows exist; rolling session generation, strict session attendance check-in, homework gating, and automatic settlement proposal dispatch to contract-service are implemented with tests. |
| `contract-service` | Contract agreement, escrow payment, settlement, dispute, lifecycle refund/expiry, blockchain transaction dispatch, Web3j read/write/event ingestion, and internal auto-propose bridge. | IMPLEMENTED | Entities/workflows and REST controllers exist for agreement listing/detail, signing, document view, payment submission, transactions, settlement propose/finalize, auto-propose internal endpoint, student dispute opening, tutor fraud explanation, staff/admin dispute resolution, expiry, and cancellation/refund. Protected contract APIs derive caller identity from the `access_token` cookie JWT. 24h dispute window and 85/15, 45/10/45, 0/0/100 settlement distributions implemented. |
| `notification-service` | Persistent user notifications, read/unread REST APIs, RabbitMQ event consumers, event idempotency, frontend Bell integration, and limited realtime notification delivery. | PARTIAL | Backend foundation exists with Flyway/JPA persistence, consumers for tutor application reviewed, teaching registration reviewed, subject request reviewed, and enrollment request events, plus raw WebSocket delivery for newly persisted notifications. Student and Portal Bell UI use REST list/unread/read APIs with realtime query invalidation and module-level click navigation to existing routes/Portal pages. Reviewer-audience notifications remain blocked until producer events carry reviewer recipient ids. |
| `eureka-server` | Listed in root Maven modules. | NEEDS_VERIFICATION | Directory contains only build output under `target/`; no active source/pom found in current scan. |
| `ai-service` | Target AI Matching service. | NOT_IMPLEMENTED | No module/source/config found. |

Feedback/notification/realtime architecture rules are maintained in `docs/FEEDBACK_NOTIFICATION_SPEC.md`. That living spec distinguishes local UI feedback, persistent notification, Bell center behavior, RabbitMQ events, WebSocket delivery, and TanStack Query invalidation. `PLANNED` rows in that spec are future requirements only, not implementation requests.

## 3. Use Case Implementation Status

| UC | Use Case | Backend | Web | Mobile | Overall | Notes |
|---|---|---|---|---|---|---|
| UC001 | Đăng ký | IMPLEMENTED | IMPLEMENTED | PARTIAL | PARTIAL | Backend/Web include OTP verification; mobile has basic register call but no full OTP flow. |
| UC002 | Đăng nhập | IMPLEMENTED | IMPLEMENTED | PARTIAL | IMPLEMENTED | Account login sets `access_token` and `refresh_token` cookies; Web refresh retry exists; mobile login is basic. |
| UC003 | Tra cứu | PARTIAL | IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL | Tutor/class public search exists; student post search not found. |
| UC004 | Quản lý yêu cầu tham gia lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Enrollment request send/cancel/list exists. |
| UC005 | Quản lý thông tin cá nhân | IMPLEMENTED | IMPLEMENTED | PARTIAL | IMPLEMENTED | Profile/password/avatar exist on Web/backend; mobile only restores user basic state. |
| UC006 | Quản lý hợp đồng | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Contract entities/workflows and REST APIs exist. Student `/contracts` reuses the shared real contract view; blockchain registration and confirmed funding workflows exist, while deployment/runtime hardening remains partial. |
| UC007 | Quản lý bài đăng tìm gia sư | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No backend entity/controller found. |
| UC008 | Quản lý tin nhắn | NOT_IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Web has mock/in-memory messaging UI; no backend persistence/API found. |
| UC009 | Xem thông tin lớp học | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Public class list/detail flow exists. |
| UC010 | Quản lý bài tập | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No homework/submission/grading source found. |
| UC011 | Quản lý thanh toán | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Escrow/payment data exists. Student Web keeps `/payments` as the payment/escrow entry point and uses `/student/wallet` as wallet-focused access. Browser funding uses escrow `fundAgreement`; submitted txHash enters `PAYMENT_CONFIRMING`, and backend activation waits for confirmed `AgreementFunded`. Address/deployment verification remains incomplete. |
| UC012 | Quản lý hồ sơ gia sư | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Tutor application/profile/documents are implemented. |
| UC013 | Quản lý yêu cầu tham gia lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Tutor accept/reject/list requests exists. |
| UC014 | Quản lý lịch rảnh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Tutor availability API/UI exists. |
| UC015 | Quản lý lớp học | PARTIAL | IMPLEMENTED | NOT_IMPLEMENTED | PARTIAL | Class create/update/visibility exists; full learning lifecycle is incomplete. |
| UC016 | Quản lý buổi học & Điểm danh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | ClassSession and SessionAttendance entities/APIs exist. Rolling weekly session generation, tutor/student check-in within session window, homework gating, and automatic settlement bridge are implemented. |
| UC017 | Quản lý bài tập theo buổi | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | IMPLEMENTED | Tutor assigns topic/homework/attachments per session. Student can only access assignment details after check-in. |
| UC018 | Theo dõi thu nhập | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Settlement/payment data exists; no complete tutor income flow found. |
| UC019 | Kiểm duyệt nội dung | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Tutor approval, subject/class review exist; post moderation not found. |
| UC020 | Quản lý vi phạm | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | No violation module found. |
| UC021 | Giám sát lớp học | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Admin/staff class review/management exists, not full monitoring. |
| UC022 | Xử lý khiếu nại | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Contract dispute workflow exists; no complete API/UI flow found. |
| UC023 | Hỗ trợ người dùng | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Admin/staff user management exists; no support ticket module found. |
| UC024 | Quản lý người dùng | IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | IMPLEMENTED | Admin/staff user APIs exist. |
| UC025 | Quản lý danh mục | IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | IMPLEMENTED | Admin teaching catalog APIs exist. |
| UC026 | Quản lý Blockchain | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Backend Web3j read/write/event ingestion exists; frontend funding/read ABI aligns to current Solidity for active Web3 use, and post-active lifecycle writes are backend-owned durable transactions. Sepolia deployment evidence remains partial. |
| UC027 | Quản lý thanh toán | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Admin payment monitoring is not complete. |
| UC028 | Báo cáo thống kê | PARTIAL | PARTIAL | NOT_IMPLEMENTED | PARTIAL | Some dashboards/stats exist; no comprehensive reporting flow found. |

## 4. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Authentication | IMPLEMENTED | Account service login/register/OTP/password reset/logout plus refresh token rotation/revocation; Web CSRF-aware API client retries refresh once on 401. |
| Student Profile | IMPLEMENTED | User profile and activate-student flows exist. |
| Tutor Profile | IMPLEMENTED | Tutor profile and public tutor APIs exist. |
| Tutor Registration | IMPLEMENTED | Tutor registration creates a `DRAFT` tutor application; current review submission requires identity documents only. |
| Tutor Approval | IMPLEMENTED | Staff tutor application approval/rejection exists; `DRAFT`/`PENDING`/`REJECTED` Tutors can use restricted Tutor context, while APPROVED is required for full Tutor operations such as class/teaching registration. |
| Search | PARTIAL | Tutor/class search exists; AI ranking and student post search are missing. |
| Tutor Availability | IMPLEMENTED | API/UI exist. |
| Class | PARTIAL | Class recruitment and review exist; full learning lifecycle incomplete. |
| Join Request | IMPLEMENTED | Student request and tutor accept/reject/cancel flows exist. |
| Student Post | NOT_IMPLEMENTED | No source evidence found. |
| Messaging | PARTIAL | Web mock UI only; backend persistence/API not found. |
| Contract | PARTIAL | Contract-service entities/workflows, REST APIs, Tutor contract flow, and Student `/contracts` shared contract view exist; registration/funding workflows require confirmed blockchain events before state activation. |
| Session | IMPLEMENTED | ClassSession entity, rolling generator, timeline UI, topic & meeting link management implemented. |
| Attendance | IMPLEMENTED | SessionAttendance entity, student check-in, tutor check-in, strict window validation, auto-finalize scheduler, outcome resolution (BOTH_PRESENT, STUDENT_ABSENT_TUTOR_PRESENT, TUTOR_ABSENT). |
| Homework | IMPLEMENTED | Assignment title, description, and file attachment per session; access gated to checked-in students. |
| Payment | PARTIAL | Escrow payment entities/workflows exist. Student `Thanh toán & Ký quỹ` remains a payment/escrow entry point, while `Ví của tôi` is a wallet-focused Web3 access point reusing `MyWalletView`. Payment submission records a funding txHash as confirmation-pending; it does not activate the agreement until `AgreementFunded` is confirmed. |
| Income | PARTIAL | Settlement data supports income concept; no complete tutor income API found. |
| Complaint | PARTIAL | Contract dispute workflow/evidence exists; full complaint module not found. |
| Notification | PARTIAL | Backend Notification Service has persistence, read/unread REST APIs, JWT-cookie recipient ownership checks, RabbitMQ consumers for recipient-available tutor application, teaching registration, subject request, class review, and enrollment events, idempotency by `eventId` + `recipientUserId`, frontend REST Bell UI with mark-read-on-click plus module-level navigation, and raw WebSocket delivery for newly persisted notifications in the supported event slice. Exact-item deep links and archive/delete remain not implemented. |
| AI Matching | NOT_IMPLEMENTED | No ai-service, Qdrant, Spring AI, embedding, or ranking implementation found. |
| Blockchain | PARTIAL | Solidity + Web3j implemented; Web has wallet-focused access through Student `/student/wallet` and Tutor Portal `wallet`, both reusing `MyWalletView`; funding confirmation is event-driven, while address/deployment verification and Sepolia evidence remain partial. |
| Escrow | PARTIAL | Smart Contract ERC-20 escrow implemented; app funding uses escrow `fundAgreement` and backend activation requires confirmed `AgreementFunded`. |
| Settlement | IMPLEMENTED | Smart Contract, backend workflow/API, event ingestion, amount persistence, Audit Timeline UI controls, and automatic bridge from finalized learning sessions to contract settlement proposals with 24h dispute window. |
| Refund | PARTIAL | Smart Contract cancellation/unused refund, backend workflow/API/event ingestion, and admin/staff UI action exist; broader accounting/income reporting remains partial. |
| Dispute | PARTIAL | Smart Contract, backend workflow/API/event ingestion, and UI dispute management exist for tutor-fraud disputes; broader complaint types remain out of scope. |
| Admin Management | IMPLEMENTED | User/catalog/class review APIs exist in part; reports/payment/blockchain admin are partial. |

## 5. Infrastructure Status

| Infrastructure | Status | Notes |
|---|---|---|
| PostgreSQL | IMPLEMENTED | Services use PostgreSQL `kltn_db` with separate Flyway history tables. |
| RabbitMQ | PARTIAL | Account/Learning events exist; Contract integration not wired via RabbitMQ. |
| S3 | IMPLEMENTED | Account-service implements avatar and tutor document storage. |
| Docker | PARTIAL | `docker-compose.yml` provides PostgreSQL and RabbitMQ only. |
| Qdrant | NOT_IMPLEMENTED | No container/config/source found. |
| Blockchain | PARTIAL | Solidity + Web3j implemented; Web has wallet-focused access through Student `/student/wallet` and Tutor Portal `wallet`, both reusing `MyWalletView`; funding confirmation is event-driven, while address/deployment verification and Sepolia evidence remain partial. |
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

### Security JWT extraction

Account service `JwtAuthenticationFilter`, Learning service `CookieJwtAuthenticationFilter`, Notification service auth, and Contract service auth read browser JWT from HttpOnly cookie `access_token`.

Contract Service now uses JWT claims (`userId`, subject email, `activeRole`, and `roles`) for agreement/document/sign/payment/dispute/transaction authorization. Frontend `role`, `userId`, `email` query parameters and `X-User-*` headers are not authoritative for Contract Service authorization.

Status: resolved for Account/Learning browser token extraction. Browser architecture remains cookie-based and must not be documented as Bearer-only.

### Tutor application lifecycle and restricted mode

Tutor application lifecycle now distinguishes account existence from Staff review submission:

- New Tutor registration creates a `TutorApplication` in `DRAFT`.
- `DRAFT` means the Tutor account/application exists but has not been submitted for Staff review.
- Current submit/resubmit completeness requires identity evidence only: CCCD/CMND front + back, or passport.
- Submit/resubmit changes the application to `PENDING`.
- Staff approval changes application/Tutor status to `APPROVED`.
- Staff rejection changes application/Tutor status to `REJECTED` and preserves the rejection reason.

Tutor `DRAFT`, `PENDING`, and `REJECTED` can authenticate with `activeRole=TUTOR` for restricted onboarding/profile correction when using the Tutor login flow. Account Service withholds `ROLE_TUTOR` unless Tutor status is `APPROVED`; Learning Service uses a local approval projection from Account events as the priority source for full Tutor authority, with a signed JWT `tutorStatus=APPROVED` fallback when projection has not arrived yet. `POST /api/auth/switch-role` is stricter: switching into Tutor mode is allowed only when both Tutor and TutorApplication are `APPROVED`, so Student -> Tutor cannot bypass Staff approval.

Status: IMPLEMENTED for backend auth/authorization and Web restricted routing. Mobile is out of scope for this status.

## 7. Planned Major Work

- AI Matching service with hard filtering, content-based scoring, weighted scoring, semantic similarity, Qdrant and Spring AI.
- Student post / tutor-search post domain.
- Messaging backend persistence/API/realtime delivery.
- Learning sessions, attendance, homework, submission and grading.
- Complete Contract blockchain registration/funding semantics, settlement/refund/dispute runtime flow, and remaining payment/admin hardening.
- Payment/income APIs and admin payment management.
- End-to-end Learning session completed -> Contract settlement -> Blockchain flow.
- Reviewer-recipient event payloads, broader producer coverage for all notification-worthy events, and richer Notification WebSocket integration beyond the current persisted-notification creation slice. Tutor-recipient teaching registration review notifications are implemented; reviewer-audience teaching registration submission notifications remain future work.
- Mobile expansion beyond auth/home.
- Sepolia deployment evidence and environment documentation.
- Frontend ABI/address alignment with Solidity.

## 8. Update Rule

Update this file when implementation changes significantly, especially when a feature moves:

- `NOT_IMPLEMENTED` -> `PARTIAL`
- `PARTIAL` -> `IMPLEMENTED`
- `KNOWN_CONFLICT` -> resolved status

Do not modify `docs/BUSINESS_RULES.md` only because implementation status changes. Business target and current implementation are separate.
