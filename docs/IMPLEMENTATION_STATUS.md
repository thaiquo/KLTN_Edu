# EduConnect — Trạng thái triển khai

> Audit baseline: **2026-09-29**. Termination and notification source/runtime rechecked 2026-10-02.
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
| `contract-service` | IMPLEMENTED + LIMITED | Agreement/signing/document/funding/settlement/refund/dispute/evidence/transaction recovery chạy thật trên Sepolia; event polling có đối soát receipt để phục hồi event bị lỡ; V1 dispute chỉ cho `BOTH_PRESENT`, legacy rows bị cách ly và ops còn giới hạn. |
| `notification-service` | IMPLEMENTED/PARTIAL | Notification persistence, REST, Rabbit consumer, WebSocket hoạt động cho event đã nối. Chat backend có persistence/API/WebSocket nhưng Web Messages chưa nối. |
| `ai-service` | SKELETON | Có Spring Boot module và `GET /api/ai/health`; chưa có matching/RAG/model/vector. |
| `frontend-web` | IMPLEMENTED/PARTIAL | Flow chính Account/Learning/Contract/Dispute/Wallet/Notification có dữ liệu thật; một số Portal dashboard/message vẫn chứa mock state. |
| `mobile-app` | PARTIAL | Login/register/home cơ bản; không có parity với Web. |

## 3. Tr�| UC002 | Đăng nhập | IMPLEMENTED | IMPLEMENTED | PARTIAL | Cookie access/refresh, refresh rotation và logout/revoke. |
| UC003 | Tra cứu | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Search/filter gia sư và lớp; chưa phải AI search. |
| UC004 | Student quản lý yêu cầu tham gia | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Gửi, xem, hủy. |
| UC005 | Student quản lý thông tin cá nhân | IMPLEMENTED | IMPLEMENTED | PARTIAL | Profile/avatar/password/wallet trên Web. |
| UC006 | Student/Tutor quản lý hợp đồng | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Snapshot, ký EIP-712, artifact, lifecycle, chấm dứt hợp đồng đơn phương (Student) & đề xuất hủy lớp (Tutor) kèm chữ ký số ví Web3; nút hủy khóa an toàn chỉ mở khi ACTIVE. |
| UC007 | Bảng tin kết nối & Khảo sát mở lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Portal Tutor/Student tách "Khám phá Bảng tin" và "Quản lý bài đăng của tôi". Poll mở lớp dùng lịch `7 ngày x 3 buổi`; Student chọn tối đa theo số buổi/tuần trên bản nháp local rồi lưu toàn bộ lựa chọn một lần, có thể mở chế độ chỉnh sửa và lưu lại. Tutor chỉ xem heatmap/thống kê; chỉ khi Tutor yêu cầu mở lớp theo đề xuất, hệ thống mới ưu tiên tổ hợp lịch có nhiều Student cùng chọn đủ, đối chiếu riêng tư với lịch rảnh/lịch lớp đang chiếm chỗ, rồi điền lịch, sĩ số tham khảo và dữ liệu cơ bản vào wizard tạo lớp dùng chung. Tutor được chỉnh toàn bộ trước khi tạo lớp `PENDING_APPROVAL`; voter chỉ nhận Bell notification sau khi tạo thành công. Xóa bài, cập nhật poll, đóng bài và chuyển khảo sát thành lớp được đồng bộ qua Learning WebSocket sau commit. Bảng tin mặc định sắp xếp thời gian mới nhất (`createdAt DESC`), tìm kiếm từ khóa (`keyword`) đa trường (tiêu đề, nội dung, tác giả, cấp học, môn, lớp gắn kèm); hỗ trợ modal xem danh sách người thích bài viết (`/posts/{id}/likes`); hỗ trợ sao chép liên kết chia sẻ bài viết (`/community?postId={id}`) có kiểm soát hiệu lực (bài ẩn/xóa trả về 404), tự cuộn và highlight nhận diện. Moderation cho Staff chưa hoàn chỉnh. |
| UC008 | Tin nhắn Student–Tutor | IMPLEMENTED | PARTIAL | NOT_IMPLEMENTED | Backend persistence/API/WebSocket có; Portal vẫn dùng mock/in-memory. |
| UC009 | Xem thông tin lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Marketplace/list/detail và lớp đã tham gia; hỗ trợ liên kết chia sẻ lớp học (`/classes/{id}`) kiểm tra điều kiện tuyển sinh qua `/api/learning/public/classes/{id}/share` (`PUBLISHED`, `startDate >= today`, chưa cutoff, còn chỗ trống); mở trực tiếp modal chi tiết lớp và highlight thẻ lớp; trả về 404 và thông báo khi lớp không còn nhận tuyển sinh. |
| UC010 | Student quản lý bài tập | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Trang riêng /my-homework trên Sidebar; xem trạng thái bài nộp (Đã khóa nếu chưa điểm danh, Cần làm, Đã nộp, Đã chấm, Quá hạn); tải file đề bài S3 sau điểm danh; nộp file bài làm S3 và tải về xem lại; cho phép gỡ bỏ/thay thế file khi còn hạn nộp kèm cơ chế tự động xóa file cũ trên S3; loại bỏ thuật ngữ kỹ thuật hạ tầng khỏi UI. |
| UC011 | Student thanh toán/ký quỹ | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | `approve` + `fundAgreement`; ACTIVE chỉ sau confirmed event. |
| UC012 | Tutor quản lý hồ sơ | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | DRAFT/PENDING/REJECTED/APPROVED và document flow. |
| UC013 | Tutor quản lý yêu cầu tham gia | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Accept/reject; ENROLLED sau funding confirm. |
| UC014 | Tutor quản lý lịch rảnh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | API/UI hiện có. |
| UC015 | Tutor quản lý lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Create/update/visibility/schedule/chapter/student capacity, upload/quản lý tài liệu môn học S3 (học viên tải không cần điểm danh), upload file lộ trình S3. |
| UC016 | Buổi học và điểm danh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Rolling sessions, điểm danh độc lập, auto-finalize, link gate, gated assignment files (khóa tải file bài tập/slide trước khi điểm danh). |
| UC017 | Tutor quản lý bài tập | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Trang riêng /tutor/homework trên Sidebar; đính kèm tối đa 5 file đề bài & slide S3; xem lại toàn bộ đề bài/yêu cầu/ghi chú đã giao; tải bài nộp S3 của học viên và chấm điểm/nhận xét; chuẩn hóa thống kê và bộ lọc chỉ tính các buổi thực tế có bài tập; hỗ trợ 2 chế độ chấm (Split View có mẫu nhận xét nhanh và lưu chuyển học viên tiếp theo; Table View xem bảng điểm toàn bộ sĩ số lớp); cảnh báo học viên chưa làm bài. |
| UC018 | Tutor theo dõi thu nhập | IMPLEMENTED/PARTIAL | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | Wallet/settlement có số confirmed; chưa có báo cáo kế toán chuyên sâu. |
| UC019 | Staff kiểm duyệt nội dung | IMPLEMENTED/PARTIAL | IMPLEMENTED/PARTIAL | NOT_IMPLEMENTED | Tutor, teaching registration, catalog suggestion và class review; Community Post đã có feed nhưng chưa có moderation/PII masking/quy trình ẩn bài cho Staff. |
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
- IMPLEMENTED: homework description/file S3 bị ẩn và khóa tải trước check-in; submission dùng attendance-owned record với file thật lưu trữ trên S3; học viên được quyền gỡ bỏ hoặc thay thế file bài làm trong hạn nộp, backend tự động xóa file cũ trên S3 để tối ưu dung lượng.
- IMPLEMENTED: quản lý tài liệu môn học cấp lớp (classroom_materials) trên AWS S3, học viên tham gia lớp tải trực tiếp không cần điểm danh; file lộ trình (syllabus) lưu trên S3.
- IMPLEMENTED: giao diện Quản lý bài tập phía Gia sư (/portal/tutor/homework) và Bài tập về nhà phía Học viên (/portal/student/homework) trên Sidebar; phân hệ Gia sư hỗ trợ thống kê chuẩn xác theo buổi có bài tập, giao diện chấm kép (Split View + Table View), mẫu nhận xét nhanh, lưu tự chuyển học viên tiếp theo và cảnh báo học viên chưa nộp.
- IMPLEMENTED: delivery worker retry các session `COMPLETED` có `settlementDispatched=false`.

### Contract, document và escrow

- IMPLEMENTED: canonical `terms_json`/`terms_hash`, hai chữ ký EIP-712 được backend recover/verify theo ví đã chốt.
- IMPLEMENTED: poi-tl sinh DOCX, Gotenberg chuyển PDF, local/S3 storage abstraction và artifact hash/status.
- IMPLEMENTED: durable backend blockchain pipeline, idempotency, locking, preflight, dispatch, receipt watch, event cursor/processed-event.
- IMPLEMENTED: funding confirmation, per-session proposal/finalization, cancellation/refund unused và expiration.
- IMPLEMENTED: luồng Chấm dứt hợp đồng & Đề xuất Hủy lớp học: Contract Flyway v12-v19, Learning v32; API `/api/contracts/terminations`; EIP-712 backend verification có freshness/replay guard; Student chỉ gửi cho hợp đồng mình, Tutor chỉ đề xuất cả lớp; hold/release Learning có retry, cutoff giữ từ lúc tiếp nhận; Staff xác minh (giới hạn theo các lớp được phân công) và Admin duyệt (`APPROVE` trực tiếp từ `REQUESTED` hoặc `RECOMMENDED`) thanh lý Escrow V1 theo từng agreement. Approval whole-class đặt lớp `LOCKED`, dừng session/enrollment tương lai; từng item đóng sẽ cập nhật enrollment/attendance tương lai sang `CANCELLED`, và lớp chỉ `CANCELLED` sau item cuối.
- IMPLEMENTED: frontend termination có điểm gửi Student trong văn bản hợp đồng; Tutor gửi từ quản lý lớp, thẻ hợp đồng theo lớp hoặc bộ chọn lớp trong tab hồ sơ. Admin có form dừng/hủy riêng. Giao diện nộp minh chứng hỗ trợ khu vực đệm (staging) cho phép thêm/xóa file/ghi chú trước khi gửi; sau khi gửi dữ liệu được lưu bất biến vào S3/PostgreSQL và ghi vết theo từng đợt (LẦN 1, LẦN 2...).
- IMPLEMENTED: Bảng “Hoàn tiền hủy hợp đồng / hủy lớp” tại Admin → Tài chính (theo dõi tiến độ từng hợp đồng, mã lỗi, số tiền hoàn, tx hash) và Học viên/Gia sư → Ví (theo dõi hồ sơ thuộc quyền, hiển thị rõ số tiền hoàn về ví học viên), tự động cập nhật mỗi 15 giây với 4 trạng thái: Chờ duyệt (`WAITING_APPROVAL`), Chờ quyết toán (`WAITING_SETTLEMENT`), Chờ blockchain (`BLOCKCHAIN_PENDING`), Hoàn tất (`COMPLETED`).
- IMPLEMENTED: Quy tắc quyết toán khi chấm dứt: Cửa sổ 24 giờ là thời hạn khiếu nại của từng buổi học đã diễn ra trước cutoff, không áp đặt 24 giờ vô cớ sau khi Admin duyệt. Worker tự động chờ các buổi liên quan quyết toán xong rồi lập tức kích hoạt hoàn cọc còn dư (`remainingDeposit`) về ví học viên.
- IMPLEMENTED: quản trị cảnh cáo Gia sư vắng 3 buổi liên tiếp: bộ quét dùng ba session `TUTOR_ABSENT` liên tiếp ngay khi Contract đã nhận outcome, tạo hồ sơ `AUTO_TUTOR_ABSENCE`, hold lịch toàn lớp và tính hạn giải trình theo buổi kế tiếp (tối đa 24 giờ, buffer 2 giờ; buổi quá gần tiếp tục bị giữ). Gia sư gửi text/file được ghi nhận thời điểm phản hồi; Staff chỉ kiến nghị sau phản hồi/hết hạn; Admin có quyền quyết định khẩn cấp có audit.
- IMPLEMENTED: Admin chủ động dừng/hủy toàn lớp hoặc một agreement qua `/terminations/admin`; có thể tạo hold để xem xét hoặc phê duyệt ngay. Dừng lịch có hiệu lực trước, còn hoàn USDC vẫn chờ settlement/dispute và event blockchain xác nhận theo Escrow V1.
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
- Refund Chấm dứt hợp đồng `AgreementCancelled` hoàn **4,80 USDC** về ví học viên `0x58abad20adecebfba5862422091eacc3f65f60e7`, hoàn tất lúc 23:44:27 ngày 22/09/2026, tx [`0x11c562e5ef55a84923cc3535dc7c30400d5252790c62ccf8411be005f4f06d6b`](https://sepolia.etherscan.io/tx/0x11c562e5ef55a84923cc3535dc7c30400d5252790c62ccf8411be005f4f06d6b). Hợp đồng và enrollment chuyển trạng thái `CANCELLED`, mốc dừng học đã đóng thành công.
- Refund hủy toàn bộ lớp `classroom_id=3`: buổi 5 hết hạn khiếu nại ngày 24/09/2026, tự chốt `REFUNDED`; giao dịch `CANCEL` [`0xb29f3db16e21a887319a79b1e3a7297d59b3c3961bb2b0d60b1b2d7c55c3a251`](https://sepolia.etherscan.io/tx/0xb29f3db16e21a887319a79b1e3a7297d59b3c3961bb2b0d60b1b2d7c55c3a251) confirmed với receipt status 1 và event `UnusedAmountRefunded` **4,20 USDC**. Case/item `COMPLETED`, agreement và class room `CANCELLED`.

Đây là bằng chứng cho các kịch bản cụ thể, không phải cam kết production SLA cho mọi điều kiện mạng.

## 6. Kiểm chứng gần nhất

- Ngày 2026-09-24: xác nhận trực tiếp PostgreSQL và Sepolia RPC cho hồ sơ hủy lớp trên; luồng tự tiến từ `WAITING_SETTLEMENT` qua `BLOCKCHAIN_PENDING` đến `COMPLETED`. Frontend dùng số hoàn từ event đã xác nhận khi hoàn tất, diễn giải các bước chờ rõ ràng và làm mới dữ liệu hợp đồng/khiếu nại định kỳ. Kiểm tra TypeScript và kiểm thử `TerminationProcessorTest`, `TerminationServiceTest` đạt.
- Bổ sung bảng dòng tiền theo từng agreement tại ví Học viên/Gia sư và màn hình Tài chính Admin: tách tiền đã trả Gia sư, phí nền tảng, hoàn theo buổi, hoàn cọc dư khi hủy và tiền còn trong Escrow. API `/terminations/refunds` cho Học viên xem khoản của chính mình khi Gia sư hủy cả lớp mà không lộ lý do/minh chứng riêng của Gia sư. Bảng ví không cộng tiền chờ hoàn hai lần vào công thức đối soát; kiểm tra TypeScript và `TerminationServiceTest` đạt. Thay đổi nguồn này cần được chạy cùng phiên bản backend/frontend mới để xuất hiện trên giao diện.
- Runtime Sepolia Testnet ngày 2026-09-22 lúc 23:44:27: Giao dịch hoàn cọc thanh lý hợp đồng `0x11c562e5ef55a84923cc3535dc7c30400d5252790c62ccf8411be005f4f06d6b` thành công; event `AgreementCancelled` được ingest, hoàn 4.80 USDC về ví học viên, DB ghi nhận cập nhật `contract_agreements` và `enrollments` thành `CANCELLED`.
- Contract Termination & EIP-712 Signature: 17 unit & integration tests (`TerminationServiceTest`, `TerminationFlowIntegrationTest`, `Eip712VerificationServiceTest`) pass 100% ngày 2026-09-22; Frontend TypeScript & Vite build pass không lỗi.
- Regression sau khi bổ sung operational hold/release ngày 2026-09-22: `contract-service` 176 test pass (7 Anvil test skip theo cấu hình), `learning-service` 71/71 test pass; frontend production build pass.
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

## Rà soát hủy lớp 02/10/2026

Follow-up audit: Account's reviewer lookup and Notification Service's internal send endpoint now require distinct short-lived service JWT scopes. Contract's outbox and direct dispatcher attach the `notification-send` token. The local database shows 14 delivered and 0 pending termination notification outbox rows, which verifies delivery into Notification Service, not browser receipt for every recipient. The running Account process still returned HTTP 500 for a missing reviewer token during the audit; the source fix and MockMvc test return 401 after that process loads the new build. Local ports 8080–8084 were open; 8085 (AI) and 5173 (web dev server) were closed. Source status for AI and Web does not imply those processes were running.

Maven test report inventory after the focused security rerun: Learning 90/90 passed, Account 140/140 passed, Notification 41/41 passed, Contract 200 passed with 7 Anvil integration tests skipped (207 total). Contract's full suite ran before the final notification-token tests, which passed in a subsequent focused run. Frontend TypeScript, utility tests and a temporary production build passed. Portal chat still uses simulated replies; AI matching and mobile contract/session flows remain incomplete. Running processes must be restarted in the order recorded in `docs/ENV_SETUP.md` before runtime behavior reflects the latest source.

Thông báo hủy lớp dùng transactional outbox V18, tra Staff/Admin qua Account bằng service JWT và chống trùng khi retry. V19 phân loại hồ sơ tự động cũ, đồng bộ hold trước khi đặt deadline mới. Chi tiết và giới hạn kiểm chứng: [báo cáo rà soát](contract/TERMINATION_REVIEW_2026_10_02.md).
