# EduConnect — Trạng thái triển khai

> Audit theo source, migration, test và bằng chứng runtime đến **2026-09-29**.  
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
| `notification-service` | IMPLEMENTED/PARTIAL | Notification persistence, REST, Rabbit consumer, WebSocket hoạt động cho event đã nối. Chat backend đã harden direct Student-Tutor contract bằng account `userId`, uniqueness theo cặp user, unread/read API và WebSocket theo `userId`; Web Messages đã nối REST/WebSocket thật. |
| `ai-service` | PARTIAL | Có health, Student-only Deterministic Matching V1, Gemini Natural Language Requirement Analyzer, Catalog Grounding qua Learning catalog, Offline Location Grounding qua Account administrative reference data, Tutor Marketplace frontend integration và Qdrant semantic retrieval foundation; chưa có Hybrid Matching V2/RAG/eval. |
| `frontend-web` | IMPLEMENTED/PARTIAL | Flow chính Account/Learning/Contract/Dispute/Wallet/Notification/Student-Tutor Messages có dữ liệu thật; một số Portal dashboard vẫn chứa mock state. |
| `mobile-app` | PARTIAL | Login/register/home cơ bản; không có parity với Web. |

## 3. Trạng thái use case

| UC | Use case | Backend | Web | Mobile | Kết luận |
| --- | --- | --- | --- | --- | --- |
| UC001 | Đăng ký | IMPLEMENTED | IMPLEMENTED | PARTIAL | OTP email hoàn chỉnh trên Web. |
| UC002 | Đăng nhập | IMPLEMENTED | IMPLEMENTED | PARTIAL | Cookie access/refresh, refresh rotation và logout/revoke. |
| UC003 | Tra cứu | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Search/filter gia sư và lớp; chưa phải AI search. |
| UC004 | Student quản lý yêu cầu tham gia | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Gửi, xem, hủy. |
| UC005 | Student quản lý thông tin cá nhân | IMPLEMENTED | IMPLEMENTED | PARTIAL | Profile/avatar/password/wallet trên Web. |
| UC006 | Student/Tutor quản lý hợp đồng | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Snapshot, ký EIP-712, artifact, lifecycle, chấm dứt hợp đồng đơn phương (Student) & đề xuất hủy lớp (Tutor) kèm chữ ký số ví Web3; nút hủy khóa an toàn chỉ mở khi ACTIVE. |
| UC007 | Bài đăng tìm gia sư | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | Chưa có domain/controller. |
| UC008 | Tin nhắn Student–Tutor | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Backend persistence/API/WebSocket, Web Messages thật cho Student/Tutor, và CTA tạo/reuse chat từ Tutor Marketplace/Public Tutor Profile đã có; mobile chưa có. |
| UC009 | Xem thông tin lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Marketplace/list/detail và lớp đã tham gia. |
| UC010 | Student quản lý bài tập | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Trang riêng /my-homework trên Sidebar; xem trạng thái bài nộp (Đã khóa nếu chưa điểm danh, Cần làm, Đã nộp, Đã chấm, Quá hạn); tải file đề bài S3 sau điểm danh; nộp file bài làm S3 và tải về xem lại; cho phép gỡ bỏ/thay thế file khi còn hạn nộp kèm cơ chế tự động xóa file cũ trên S3; loại bỏ thuật ngữ kỹ thuật hạ tầng khỏi UI. |
| UC011 | Student thanh toán/ký quỹ | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | `approve` + `fundAgreement`; ACTIVE chỉ sau confirmed event. |
| UC012 | Tutor quản lý hồ sơ | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | DRAFT/PENDING/REJECTED/APPROVED và document flow. |
| UC013 | Tutor quản lý yêu cầu tham gia | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Accept/reject; ENROLLED sau funding confirm. |
| UC014 | Tutor quản lý lịch rảnh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | API/UI hiện có. |
| UC015 | Tutor quản lý lớp | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Create/update/visibility/schedule/chapter/student capacity, upload/quản lý tài liệu môn học S3 (học viên tải không cần điểm danh), upload file lộ trình S3. |
| UC016 | Buổi học và điểm danh | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Rolling sessions, điểm danh độc lập, auto-finalize, link gate, gated assignment files (khóa tải file bài tập/slide trước khi điểm danh). |
| UC017 | Tutor quản lý bài tập | IMPLEMENTED | IMPLEMENTED | NOT_IMPLEMENTED | Trang riêng /tutor/homework trên Sidebar; đính kèm tối đa 5 file đề bài & slide S3; xem lại toàn bộ đề bài/yêu cầu/ghi chú đã giao; tải bài nộp S3 của học viên và chấm điểm/nhận xét; chuẩn hóa thống kê và bộ lọc chỉ tính các buổi thực tế có bài tập; hỗ trợ 2 chế độ chấm (Split View có mẫu nhận xét nhanh và lưu chuyển học viên tiếp theo; Table View xem bảng điểm toàn bộ sĩ số lớp); cảnh báo học viên chưa làm bài. |
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
- IMPLEMENTED: homework description/file S3 bị ẩn và khóa tải trước check-in; submission dùng attendance-owned record với file thật lưu trữ trên S3; học viên được quyền gỡ bỏ hoặc thay thế file bài làm trong hạn nộp, backend tự động xóa file cũ trên S3 để tối ưu dung lượng.
- IMPLEMENTED: quản lý tài liệu môn học cấp lớp (classroom_materials) trên AWS S3, học viên tham gia lớp tải trực tiếp không cần điểm danh; file lộ trình (syllabus) lưu trên S3.
- IMPLEMENTED: giao diện Quản lý bài tập phía Gia sư (/portal/tutor/homework) và Bài tập về nhà phía Học viên (/portal/student/homework) trên Sidebar; phân hệ Gia sư hỗ trợ thống kê chuẩn xác theo buổi có bài tập, giao diện chấm kép (Split View + Table View), mẫu nhận xét nhanh, lưu tự chuyển học viên tiếp theo và cảnh báo học viên chưa nộp.
- IMPLEMENTED: delivery worker retry các session `COMPLETED` có `settlementDispatched=false`.

### Contract, document và escrow

- IMPLEMENTED: canonical `terms_json`/`terms_hash`, hai chữ ký EIP-712 được backend recover/verify theo ví đã chốt.
- IMPLEMENTED: poi-tl sinh DOCX, Gotenberg chuyển PDF, local/S3 storage abstraction và artifact hash/status.
- IMPLEMENTED: durable backend blockchain pipeline, idempotency, locking, preflight, dispatch, receipt watch, event cursor/processed-event.
- IMPLEMENTED: funding confirmation, per-session proposal/finalization, cancellation/refund unused và expiration.
- IMPLEMENTED: luồng Chấm dứt hợp đồng & Đề xuất Hủy lớp học: Contract Flyway v12-v14, Learning v32; API `/api/contracts/terminations`; EIP-712 backend verification có freshness/replay guard; Student chỉ gửi cho hợp đồng mình, Tutor chỉ đề xuất cả lớp; hold/release Learning có retry, cutoff giữ từ lúc tiếp nhận; Staff xác minh (giới hạn theo các lớp được phân công) và Admin duyệt (`APPROVE` trực tiếp từ `REQUESTED` hoặc `RECOMMENDED`) thanh lý Escrow V1 theo từng agreement. Approval whole-class đặt lớp `LOCKED`, dừng session/enrollment tương lai; từng item đóng sẽ cập nhật enrollment/attendance tương lai sang `CANCELLED`, và lớp chỉ `CANCELLED` sau item cuối.
- IMPLEMENTED: frontend termination có đúng hai điểm gửi nghiệp vụ: Student trong văn bản hợp đồng và Tutor trong quản lý lớp; tab hồ sơ chỉ theo dõi/xét duyệt. Giao diện nộp minh chứng hỗ trợ khu vực đệm (staging) cho phép thêm/xóa file/ghi chú trước khi gửi; sau khi gửi dữ liệu được lưu bất biến vào S3/PostgreSQL và ghi vết theo từng đợt (LẦN 1, LẦN 2...).
- IMPLEMENTED: Bảng “Hoàn tiền hủy hợp đồng / hủy lớp” tại Admin → Tài chính (theo dõi tiến độ từng hợp đồng, mã lỗi, số tiền hoàn, tx hash) và Học viên/Gia sư → Ví (theo dõi hồ sơ thuộc quyền, hiển thị rõ số tiền hoàn về ví học viên), tự động cập nhật mỗi 15 giây với 4 trạng thái: Chờ duyệt (`WAITING_APPROVAL`), Chờ quyết toán (`WAITING_SETTLEMENT`), Chờ blockchain (`BLOCKCHAIN_PENDING`), Hoàn tất (`COMPLETED`).
- IMPLEMENTED: Quy tắc quyết toán khi chấm dứt: Cửa sổ 24 giờ là thời hạn khiếu nại của từng buổi học đã diễn ra trước cutoff, không áp đặt 24 giờ vô cớ sau khi Admin duyệt. Worker tự động chờ các buổi liên quan quyết toán xong rồi lập tức kích hoạt hoàn cọc còn dư (`remainingDeposit`) về ví học viên.
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
- IMPLEMENTED backend chat: conversation/message tables, participant authorization theo account `userId`, một direct conversation duy nhất cho mỗi cặp Student-Tutor, message persistence, paginated history, explicit mark-read, unread count, REST và `/ws/chat`.
- IMPLEMENTED trong phạm vi Phase 5.1: direct chat chỉ cho Student với Tutor đã approved; identity/eligibility được resolve từ Account Service, sender/recipient không tin từ body request, WebSocket route gửi theo `userId`, migration fail rõ nếu dữ liệu cũ có duplicate direct pair cần merge thủ công.
- IMPLEMENTED trong phạm vi Phase 5.2: Web `MessagesView` tải conversation/history thật, gửi text message thật, mark-read rõ ràng, consume `/ws/chat` qua Gateway, không còn mock conversation/reply generator trong runtime messages. Chưa có call/typing/presence/mobile parity.
- IMPLEMENTED trong phạm vi Phase 5.3: Student có thể mở hoặc reuse direct conversation từ Tutor Marketplace manual/AI card và Public Tutor Profile bằng `tutor.userId`, sau đó được điều hướng vào Web Messages qua query `conversation`.
- IMPLEMENTED trong phạm vi Phase 5.3.1: Student Messages bỏ hero/description để mở trực tiếp workspace; Student/Tutor dùng cùng `MessagesView` gọn hơn, không còn nút fake emoji/call trong runtime chat; incoming/outgoing message được merge ngay từ POST/`NEW_MESSAGE` thay vì refetch full history, mark-read realtime được coalesce nhẹ, `/ws/chat` giữ một active socket mỗi client, và cấu hình realtime frontend chịu được legacy `VITE_REALTIME_URL` để tránh URL `/api/notifications/ws/ws/...`.
- IMPLEMENTED trong phạm vi Phase 5.4/5.4.1: Student/Tutor Web Messages gửi và nhận ảnh/video đính kèm qua Notification Service. Một lần gửi ảnh tạo một `IMAGE` message với 1-5 ảnh, tối đa 10 MB/ảnh; một lần gửi video tạo một `VIDEO` message với đúng 1 video, tối đa 40 MB; không cho trộn ảnh và video. File được validate MIME/signature/size, upload vào private S3, DB chỉ lưu metadata/object key/SHA-256 trong `chat_attachments`, REST trả presigned URL ngắn hạn, và `/ws/chat` chỉ gửi metadata trong `NEW_MESSAGE` chứ không gửi binary. Runtime verification ngày 2026-10-05: upload ảnh PNG và video WebM thật qua UI, render sau refresh, DB có `IMAGE`/`VIDEO` rows metadata-only, WebSocket có 0 binary frames. Typing/presence/call/Bell summary/mobile parity vẫn chưa triển khai.

### AI

- PARTIAL: module Maven/Spring Boot port 8085, Gateway route, health endpoint, Student-only Deterministic Matching V1, Gemini Natural Language Requirement Analyzer, Catalog Grounding và Offline Location Grounding.
- IMPLEMENTED trong phạm vi Phase 4.3.1: Gemini chỉ trích xuất nhu cầu học tập có cấu trúc từ tiếng Việt; không matching, không ranking, không sinh catalog IDs.
- IMPLEMENTED trong phạm vi Phase 4.3.2: Java + Learning catalog resolve `subjectHint`/`levelHint` sang IDs thật, trả clarification khi thiếu/mơ hồ/not-found/invalid relationship; không tự gọi Matching V1.
- IMPLEMENTED trong phạm vi Phase 4.3.2.1: Java + Account administrative reference data resolve OFFLINE `locationHint` sang `provinceCode`/`communeCode` khi có match duy nhất; location là tiêu chí mềm nên thiếu/mơ hồ/not-found không làm mất `coreMatchingReady` nếu subject/level/teachingMode đã sẵn sàng.
- IMPLEMENTED trong phạm vi Phase 4.3.3: Tutor Marketplace large modal gọi Analyze -> Ground -> Matching V1 sau khi Student xác nhận, render ranked Tutor cards bằng `matchPercentage` và `matchingReasons` thật; không có standalone AI Matching page/header item.
- IMPLEMENTED trong phạm vi Web V1 Phase 4.3.3.3B: Tutor Marketplace lưu search session bằng frontend abstraction trên `sessionStorage` có version/TTL/account scope; Manual Search và AI Matching được restore tách biệt khi quay lại từ Tutor Detail hoặc F5, không dùng Redis và không biến AI requirement thành manual filters.
- IMPLEMENTED trong phạm vi Phase 4.4.1: Gemini `gemini-embedding-2` embedding abstraction/runtime prepared with 768-dimensional vectors and deterministic semantic text builders.
- IMPLEMENTED trong phạm vi Phase 4.4.2: Qdrant dev vector store, collection init/validation, public tutor capability indexing, document-hash skip, deterministic point IDs, Staff/Admin semantic maintenance endpoints and raw semantic retrieval foundation.
- IMPLEMENTED trong pham vi Phase 4.4.3: Semantic candidate retrieval consumes grounded student requirements, skips embedding when no meaningful semantic context exists, hard-scopes Qdrant by subject/level/mode, validates hits against Account Search V2 authoritative tutor data, rejects stale hits, deduplicates capability hits by tutor, and returns raw `SemanticTutorCandidate` similarity without changing Matching V1 or frontend.
- IMPLEMENTED trong pham vi Phase 4.4.4: Hybrid Matching V2 backend keeps Matching V1 as baseline, joins validated semantic candidates by tutor, applies only a bounded rank-based semantic boost, preserves V1 when semantic is not applicable or fails, and does not expose raw cosine as match percentage.
- NOT_IMPLEMENTED: frontend Hybrid UX/evaluation labels, RAG, chatbot, production eval/monitoring.

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

1. Hoàn thiện mobile theo các flow Web cần thiết, bao gồm messages.
2. Bổ sung mobile chat parity khi business flow cho phép.
3. Nâng AI Matching từ semantic retrieval foundation sang Hybrid Matching V2/ranking/eval; không để Gemini tự chọn Tutor hoặc sinh điểm giả.
4. Bổ sung violation/support ticket và reporting tổng hợp.
5. Tăng cường production ops: multi-RPC/failover, operator HA an toàn, metrics/alerting, backup/restore drill.
6. Nếu cần khiếu nại cho outcome ngoài `BOTH_PRESENT`, thiết kế/deploy Solidity version mới; không vá lệch backend với V1.

## 8. Nguyên tắc cập nhật

Khi source thay đổi, cập nhật file này dựa trên đủ bằng chứng: entity/migration + service + controller/security + client + test/runtime phù hợp. Không dùng UI mock, comment hoặc tên file làm bằng chứng duy nhất cho `IMPLEMENTED`.

## Phase 4.4 Semantic Notes

AI status remains PARTIAL. Phase 4.4.1 selected Google Gemini `gemini-embedding-2`, 768 dimensions, reusing `GEMINI_API_KEY`. Phase 4.4.2 adds Qdrant-backed tutor capability indexing and raw semantic retrieval foundation. Phase 4.4.3 turns raw retrieval into validated semantic tutor candidates. Phase 4.4.4 adds conservative Hybrid Matching V2 backend ranking with V1 fallback. Phase 4.4.5 connects the existing Tutor Marketplace AI flow to Hybrid V2 transparently, preserves backend ranking order, sends learning-goal/weak-topic/tutor-preference context, and restores AI result snapshots without replaying provider calls. Phase 4.4.6 enriches development-only Tutor semantic descriptions and validates selective Qdrant re-indexing plus a small offline semantic/hybrid evaluation set; it is seed/evaluation work, not proof of production matching accuracy. RAG, chatbot, production evaluation and monitoring are still not implemented.

## Phase 4.6.2 Public Class Marketplace Notes

Manual Public Class Search V1 is implemented through the existing Learning endpoint `GET /api/public/classes`. The backend owns eligibility and filtering: marketplace results include only `PUBLISHED` and `ACTIVE` classes, support catalog/subject/level/mode/price/schedule/capacity filters, deterministic sort values `newest`, `price_asc`, `price_desc`, `soonest`, and `rating_desc`, and return server-paged public card DTOs without meeting links, invite keys, tutor emails, or staff review metadata.

Phase 4.6.2.1 refines the Web Class Marketplace manual filters: the Subject dropdown is intentionally removed from the UI while backend `subjectId` remains supported; displayed Level options are deduplicated from all active subjects in the current Program -> Education Level -> Category scope and sent as `levelIds`; selected schedule days are treated as Student availability, so every recurring class schedule must fit within the selected days and optional time window. Later Phase 4.6.4-4.6.5 adds backend AI Class Search separately; final frontend AI-ranked class result rendering remains NOT_IMPLEMENTED.

## Phase 4.6.3 AI Class Search Analyze/Ground Notes

AI Class Search is now PARTIAL for Analyze -> Ground -> Review only. `ai-service` adds Student-only `/api/ai/classes/analyze` and `/api/ai/classes/ground`; Gemini extracts class-search hints without IDs/rankings, and deterministic Java grounding resolves subject/level against the Learning catalog snapshot with clarification support. The Class Marketplace has a large modal CTA that runs this flow independently from manual search. Class embeddings, Qdrant class vectors, semantic class retrieval, Hybrid Class Matching, and AI-ranked class result rendering remain NOT_IMPLEMENTED.

## Phase 4.6.4-4.6.5 Class Semantic/Hybrid Backend Notes

Backend Class AI Search is IMPLEMENTED for the backend contract. Learning Service now exposes public-safe `GET /api/public/classes/semantic-source` for indexing and authoritative validation. AI Service adds dedicated class semantic infrastructure using Qdrant collection `public_classes_v1`, one vector per public class, deterministic point IDs from `classId`, document-hash skip, stale point cleanup, and safe payload metadata only.

Student-only `POST /api/ai/classes/match` now performs structured class matching from grounded subject/level/teachingMode and optionally applies validated semantic retrieval as a bounded rank boost. Hard eligibility remains authoritative and cannot be bypassed: public status `PUBLISHED`/`ACTIVE`, subject, level, teaching mode, available seats, and schedule compatibility are required. Missing vectors are neutral, raw cosine is not exposed as `matchPercentage`, and Gemini/Qdrant/Learning validation failures fall back to structured V1.

Runtime verification on 2026-10-05: updated Learning started on port `18082`, updated AI started on port `18085`, Qdrant `public_classes_v1` synced 3 real class points with `indexed=3`, `failed=0`, Qdrant count returned 3, and real `POST /api/ai/classes/match` returned `rankingMode=HYBRID_V2` with semantic boost. Final frontend AI-ranked class result rendering is covered by Phase 4.6.6.

## Phase 4.6.6 AI Class Search Frontend Notes

Final Class Marketplace AI result rendering is IMPLEMENTED in the Web frontend. The existing large modal now completes Analyze -> Ground -> Review -> Match, calls `POST /api/ai/classes/match` with the grounded requirement and `topK`, and renders returned class matches using the existing public class card UI plus `% phù hợp` and backend `matchingReasons`.

Manual Class Search and AI Class Search are kept independent. Manual filters, sort, pagination, URL state, and Learning public class search remain unchanged. AI mode stores a returned result snapshot in account-scoped, versioned, TTL-limited `sessionStorage`; Detail -> Back and F5 restore the AI result without replaying Analyze/Ground/Match or provider/vector calls. Failed new AI searches keep the previous successful AI result until a new match response succeeds.

Privacy/status note: the Web UI does not expose raw semantic similarity, vector IDs, Qdrant metadata, document hashes, embedding model internals, score breakdown internals, meeting links, join keys, tutor email, or private Student data. On 2026-10-05 Qdrant `public_classes_v1` was green with `points_count=3`; no bulk re-index was performed for this frontend phase. Verification: frontend production build passed; `ai-service` Maven tests passed 151 run, 0 failures/errors, 4 skipped.

