# 📋 NHẬT KÝ THAY ĐỔI & TIẾN ĐỘ DỰ ÁN (PROJECT CHANGELOG)

---

## 📌 Mốc Hoàn Thành Toàn Diện (Tháng 09/2026)

### 1. Phân hệ Blockchain & Smart Contract Escrow
- Triển khai thành công Master Smart Contract `EduConnectEscrow.sol` (Solidity 0.8.36, OpenZeppelin) trên mạng **Ethereum Sepolia Testnet** tại địa chỉ: `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`.
- Tích hợp đồng tiền thanh toán chuẩn ERC-20: **Circle Mock USDC** (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`).
- Hoàn thiện luồng ký số điện tử **EIP-712** với mã hóa cryptographic proof thật từ ví MetaMask.
- Cơ chế giải ngân tự động: **85%** cho Gia sư, **15%** cho Sàn sau mỗi buổi học được điểm danh và hết khung giờ khiếu nại 24h.
- Cơ chế phân xử tranh chấp (Dispute Management Panel) với quyền Trọng tài (Arbitrator).

### 2. Phân hệ Contract Service (`backend/contract-service` - Port 8084)
- Xây dựng quy trình quản lý vòng đời hợp đồng: `DRAFT` -> `PENDING_TUTOR_ACCEPTANCE` -> `PENDING_STUDENT_ACCEPTANCE` -> `WAITING_PAYMENT` -> `ACTIVE` -> `COMPLETED`.
- Snapshot bất biến toàn bộ điều khoản hợp đồng (`terms_json`, `terms_hash`).
- Scheduler tự động quét và hủy hợp đồng quá hạn 24 giờ chưa nạp cọc (`ContractExpirationScheduler`).
- Xuất bản văn bản hợp đồng pháp lý chuẩn định dạng **Microsoft Word (.docx)** và **PDF** tự động gắn con dấu chữ ký số EIP-712.
- Dual-channel sync: Đồng bộ kích hoạt hợp đồng sang `learning-service` qua REST API trực tiếp và Message Queue RabbitMQ (`contract.activated.v1`).

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
