# 📋 NHẬT KÝ THAY ĐỔI & TIẾN ĐỘ DỰ ÁN (PROJECT CHANGELOG)

---

## 22/09/2026 — Hoàn tất Chấm dứt hợp đồng, Xác thực EIP-712 và Hoàn tiền Escrow Sepolia Thành công

- **Nghiệp vụ Chấm dứt & Hủy lớp**:
  - Học viên đơn phương chấm dứt hợp đồng (`wholeClass=false`) thực hiện trong văn bản hợp đồng cá nhân.
  - Gia sư đề xuất dừng giảng dạy & hủy toàn bộ lớp học (`wholeClass=true`) trong mục Quản lý Lớp học.
  - Cả hai thao tác đều xác thực chữ ký số điện tử EIP-712 Typed Data gasless, đối chiếu địa chỉ ví MetaMask với ví đã chốt trên hợp đồng/nạp cọc để chống giả mạo danh tính và gian lận tài chính.
- **Khu vực đệm Minh chứng & Tính bất biến (Evidence Staging & Immutability)**:
  - Bổ sung cơ chế đệm (staging) cho phép người dùng xem trước, thêm/xóa (`[✕ Xóa]`) file tài liệu và ghi chú giải trình trước khi nhấn nút gửi chính thức.
  - Sau khi gửi, tài liệu được lưu bất biến vào S3 và PostgreSQL (audit trail), không cho phép xóa hay sửa đổi. Các lần gửi bổ sung được phân tách và đánh số theo đợt (`LẦN 1`, `LẦN 2`...) kèm mốc thời gian rõ ràng.
- **Phân định thẩm quyền Ban Quản trị**:
  - Nhân viên (Staff): Chỉ xem và thẩm định các hồ sơ thuộc lớp do mình được phân công duyệt (`classroomReviewerEmail`), có quyền kiến nghị (`RECOMMEND`) hoặc từ chối (`REJECT`).
  - Quản trị viên (Admin): Toàn quyền hệ thống, có thể phê duyệt trực tiếp (`APPROVE`) từ trạng thái `REQUESTED` hoặc `RECOMMENDED` để kích hoạt quyết toán & thanh lý Escrow V1, hoặc từ chối (`REJECT`) để giải phóng hold và khôi phục lớp học.
- **Xác thực Giao dịch Hoàn tiền Thực tế trên Sepolia**:
  - Giao dịch thanh lý hợp đồng thành công lúc **23:44:27 ngày 22/09/2026**: [`0x11c562e5ef55a84923cc3535dc7c30400d5252790c62ccf8411be005f4f06d6b`](https://sepolia.etherscan.io/tx/0x11c562e5ef55a84923cc3535dc7c30400d5252790c62ccf8411be005f4f06d6b).
  - Event `AgreementCancelled` ghi nhận hoàn **4,80 USDC** về ví học viên `0x58abad20adecebfba5862422091eacc3f65f60e7`.
  - Hợp đồng (`contract_agreements`) và enrollment đều chuyển trạng thái `CANCELLED`; mốc dừng học đã đóng thành công.
- **Cơ chế Quyết toán & Thời hạn 24 giờ**:
  - Làm rõ quy tắc: Thời hạn 24 giờ là cửa sổ khiếu nại của từng buổi học đã dạy trước cutoff, không phải thời hạn chờ bắt buộc sau khi Admin duyệt.
  - Worker tự động chờ các buổi liên quan quyết toán xong (sau 24h hoặc phán quyết) rồi lập tức kích hoạt hoàn cọc còn dư (`remainingDeposit`) về ví học viên.
- **Bảng Theo dõi Hoàn tiền Tự động**:
  - Tích hợp bảng "Hoàn tiền hủy hợp đồng / hủy lớp" tại Admin Tài chính và Ví cá nhân (Học viên / Gia sư).
  - Tự động đồng bộ mỗi 15 giây, phân định 4 trạng thái tiến độ: Chờ duyệt (`WAITING_APPROVAL`), Chờ quyết toán (`WAITING_SETTLEMENT`), Chờ blockchain (`BLOCKCHAIN_PENDING`), và Hoàn tất (`COMPLETED`).

---
## 15/09/2026 — Đồng bộ tài liệu toàn dự án

- Audit lại service/module, controller, entity, migration, security, frontend route/API, Solidity và runtime settlement evidence.
- Xác nhận kiến trúc là **Service-Based Architecture** với 6 backend service: Gateway 8080, Account 8081, Learning 8082, Contract 8083, Notification/Chat 8084 và AI skeleton 8085.
- Loại bỏ tài liệu cũ về raw-USDC-transfer fallback; funding hợp lệ bắt buộc gọi `fundAgreement` và được xác nhận bởi `AgreementFunded`.
- Cập nhật frontend ABI/local addresses đã khớp Solidity/deployment artifact.
- Ghi nhận Sepolia payout 85/15 và refund `TUTOR_ABSENT` 100% đã xác nhận.
- Ghi đầy đủ session attendance độc lập, link/homework gate, restart catch-up, per-Student settlement và dispute privacy/response window.
- Ghi nhận Contract dispute evidence lưu S3 theo key agreement/session/role, tối đa 50 MB, metadata SHA-256 trong PostgreSQL.
- Điều chỉnh Messaging: backend chat persistence/API/WebSocket đã có, nhưng Web Portal vẫn dùng mock state nên UC008 còn PARTIAL.
- Điều chỉnh AI: `ai-service` đã có skeleton/health, nhưng matching/RAG/vector/model vẫn NOT_IMPLEMENTED.
- Thay các tuyên bố “100% hoàn thành” tổng quát bằng trạng thái có phạm vi, evidence và giới hạn.

## 📌 Mốc Hoàn Thành Toàn Diện (Tháng 09/2026)

### 1. Phân hệ Blockchain & Smart Contract Escrow
- Triển khai thành công Master Smart Contract `EduConnectEscrow.sol` (Solidity 0.8.36, OpenZeppelin) trên mạng **Ethereum Sepolia Testnet** tại địa chỉ: `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`.
- Tích hợp đồng tiền thanh toán chuẩn ERC-20: **Circle Mock USDC** (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`).
- Hoàn thiện luồng ký số điện tử **EIP-712** với mã hóa cryptographic proof thật từ ví MetaMask.
- Cơ chế giải ngân tự động: **85%** cho Gia sư, **15%** cho Sàn sau mỗi buổi học được điểm danh và hết khung giờ khiếu nại 24h.
- Cơ chế phân xử tranh chấp (Dispute Management Panel) với quyền Trọng tài (Arbitrator).

### 2. Phân hệ Contract Service (`backend/contract-service` - Port 8083)
- Xây dựng quy trình quản lý vòng đời hợp đồng: `DRAFT` -> `PENDING_TUTOR_ACCEPTANCE` -> `PENDING_STUDENT_ACCEPTANCE` -> `WAITING_PAYMENT` -> `ACTIVE` -> `COMPLETED`.
- Snapshot bất biến toàn bộ điều khoản hợp đồng (`terms_json`, `terms_hash`).
- Scheduler tự động quét và hủy hợp đồng quá hạn 24 giờ chưa nạp cọc (`ContractExpirationScheduler`).
- Xuất bản văn bản hợp đồng pháp lý chuẩn định dạng **Microsoft Word (.docx)** và **PDF** tự động gắn con dấu chữ ký số EIP-712.
- Đồng bộ kích hoạt hợp đồng sang `learning-service` bằng internal REST sau khi blockchain event được xác nhận. Contract outbox giữ audit/delivery state; không coi RabbitMQ là kênh xác nhận tiền.

### 3. Phân hệ Learning Service (`backend/learning-service` - Port 8082)
- Quản lý danh mục môn học, tạo lớp học với cấu hình lịch học, thời lượng, học phí.
- Cơ chế phân tách quyền truy cập phòng học nghiêm ngặt:
  - `ACCEPTED`: Học viên được duyệt hợp đồng -> Giữ chỗ trong lớp (`reservedSlot`), chưa có link phòng học.
  - `ENROLLED`: Học viên đã hoàn tất nạp cọc Escrow on-chain -> Cấp quyền vào lớp học Google Meet / Zoom và tài liệu.
- Quản lý điểm danh buổi học và nhật ký giảng dạy.

### 4. Phân hệ Account Service (`backend/account-service` - Port 8081)
- Xác thực người dùng bằng JWT Cookie HttpOnly chống XSS.
- Quên mật khẩu & Đăng ký xác thực qua mã OTP Email.
- Nộp hồ sơ gia sư, tải bằng cấp / chứng chỉ lên **AWS S3**.
- Bảng điều khiển kiểm duyệt hồ sơ gia sư dành cho Nhân viên (Staff/Admin).
- Liên kết và quản lý địa chỉ ví Web3 (MetaMask).

### 5. Phân hệ Frontend Web (`frontend-web` - Port 5173)
- Giao diện Marketplace tìm kiếm, lọc và phân trang lớp học.
- Modal xem văn bản hợp đồng điện tử EIP-712 kèm tính năng ký số trực tiếp bằng MetaMask.
- Modal nạp cọc Smart Contract Escrow 2 bước (`Approve USDC` -> `Ký quỹ USDC on-chain`).
### 6. Phân hệ Buổi học, Điểm danh Cuốn chiếu & Quản lý Lớp học Thực tế (03/09/2026)
- **Database Schema**: Tạo bảng `class_sessions` và `session_attendances` (Flyway migration V26) ghi nhận từng buổi học, chủ đề, bài tập và điểm danh hai chiều.
- **Tự động sinh buổi học cuốn chiếu**: `RollingSessionService` & `ClassroomLifecycleScheduler` tự động mở 3 buổi tuần đầu và sinh cuốn chiếu theo lịch tuần của lớp.
- **Điểm danh nghiêm ngặt**: Chỉ cho phép điểm danh vào học/vào dạy trong đúng khung giờ `[start_time, end_time]`.
- **Mở khóa bài tập theo điểm danh (Gated Assignment Access)**: Học viên phải điểm danh thành công thì mới mở khóa xem đề bài và link tải file tài liệu đính kèm.
- **Quản lý Buổi học phía Gia sư**: Thêm mục Sidebar "Quản lý Buổi học" (`TutorSessionManagement.tsx`) với bộ chọn lớp và timeline chi tiết.
- **Lớp học của tôi phía Học viên**: Làm mới hoàn toàn (`StudentClassManagement.tsx`) với dữ liệu thật 100%, phân quyền chặt chẽ theo tài khoản đăng nhập (Role-based Data Segregation).
- **Cơ chế chống Logout tự động**: Tinh chỉnh `client.js` không đá văng phiên đăng nhập khi gặp lỗi 401 cục bộ ở các endpoint thứ cấp.

---

## 📌 Mốc Khởi Tạo & Chuyển Đổi Kiến Trúc (Tháng 06/2026)
- Xây dựng bộ khung kiến trúc hướng dịch vụ (Service-Based Architecture).
- Tách biệt 4 service: `api-gateway`, `account-service`, `learning-service`, `contract-service`.
- Cấu hình PostgreSQL (Port 5434), RabbitMQ (Port 5672) và Docker Compose.
- Thiết lập quy chuẩn tài liệu kỹ thuật trong thư mục `docs/`.
