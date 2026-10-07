# 📋 NHẬT KÝ THAY ĐỔI & TIẾN ĐỘ DỰ ÁN (PROJECT CHANGELOG)

---

## 29/09/2026 — Nâng Cấp Quản Lý & Chấm Bài Tập Gia Sư Toàn Diện, Tự Động Dọn Dẹp S3 Khi Gỡ Bài Nộp, Đồng Bộ Hiển Thị Lớp Học Thực Tế

- **Chuẩn hóa Thống kê & Phân loại Bài tập Gia sư**:
  - Khắc phục triệt để lỗi thống kê hiển thị sai lệch "19 học viên chưa làm bài" (do trước đây hệ thống tính gộp toàn bộ 20 buổi học của tất cả các lớp, bao gồm 19 buổi học bình thường không giao bài tập).
  - Tối ưu hóa 4 thẻ thống kê trên cùng trang Quản lý bài tập của Gia sư (`/portal/tutor/homework`), chỉ tính toán dữ liệu trên các buổi thực tế có bài tập:
    1. `Buổi đã giao bài tập`: Tổng số buổi học có giao bài tập hoặc đính kèm tài liệu đề bài.
    2. `Tổng bài học viên đã nộp`: Tổng số lượt học viên đã nộp bài tập về nhà.
    3. `Bài đang chờ chấm điểm`: Số bài tập đã nộp cần gia sư chấm và nhận xét.
    4. `Bài đã chấm điểm xong`: Số bài tập gia sư đã hoàn thành chấm điểm (thể hiện kết quả công việc, thay cho thẻ gây hiểu lầm trước đó).
  - **Lọc thông minh danh sách buổi học**: Mặc định chỉ hiển thị các buổi học có giao bài tập (`assignmentTitle`, `assignmentDescription`, `assignmentFiles` hoặc đã có bài nộp). Các buổi học bình thường không giao bài sẽ được ẩn đi để màn hình gọn gàng, tránh hiểu lầm; bổ sung tùy chọn trong dropdown *"Xem tất cả buổi học (kể cả chưa giao bài)"* khi gia sư muốn tìm lại buổi để giao bài mới.
- **Nâng cấp Giao diện Chấm bài Hai chế độ (Dual Views) cho Gia sư**:
  - Bổ sung nút chuyển đổi linh hoạt giữa 2 chế độ hiển thị trong modal chấm bài:
    - **Chế độ Chấm chi tiết (Split View)**:
      - Cột trái: Ô tìm kiếm học viên theo Tên/Email/Mã số, các tab lọc nhanh (`Tất cả`, `Cần chấm`, `Chưa nộp`, `Đã chấm`, `Nộp muộn`), nhãn trạng thái điểm danh vào học và trạng thái nộp bài.
      - Cột phải: Khung đối chiếu đề bài gốc; bảng cảnh báo nổi bật nếu học viên chưa nộp bài kèm hướng dẫn cho điểm trực tiếp (vấn đáp/trả lời tại lớp) hoặc ghi chú nhắc nhở; các chip chọn điểm số nhanh (10, 9.5, 9... Đạt/Chưa đạt); gợi ý câu nhận xét chuẩn mực (`QUICK_FEEDBACK_TEMPLATES`); nút tiện ích **"Lưu & Sang học viên tiếp theo"** tự động chuyển ngay sang học viên kế tiếp cần chấm giúp gia sư chấm liên tục cả lớp với tốc độ cao.
    - **Chế độ Bảng điểm cả lớp (Classroom Table View)**: Bảng danh sách tổng hợp toàn bộ học viên của buổi học gồm STT, Họ tên & Email, Điểm danh (Có mặt / Vắng), Trạng thái nộp bài (thời gian nộp hoặc nhãn đỏ `Chưa làm / Chưa nộp bài`), Tệp đính kèm & nút tải nhanh, Điểm số, Nhận xét chi tiết của gia sư và nút thao tác nhanh chuyển đến chấm/sửa điểm.
- **Vòng đời Nộp bài của Học viên & Tự động Dọn dẹp S3 (S3 Storage Cleanup)**:
  - Cho phép học viên gỡ bỏ hoặc thay thế file bài làm đã nộp trong khoảng thời gian còn hạn nộp (deadline).
  - Khi học viên gỡ bỏ hoặc tải lên file bài làm mới thay thế, hệ thống tự động xóa file cũ trên AWS S3 (`s3Client.deleteObject`) nhằm giải phóng dung lượng và chống phát sinh file rác trên bucket.
  - Loại bỏ hoàn toàn các thuật ngữ kỹ thuật hạ tầng nội bộ (như "tải lên S3", "S3 bucket", "S3 key"...) trên giao diện người dùng, thay bằng thông điệp thân thiện: *"Đã nộp bài thành công"*, *"Tải bài nộp"*, *"Đang lưu bài làm"...*
- **Đồng bộ Link học & Đề xuất lớp học đến giờ dạy**:
  - Đồng bộ chặt chẽ: Link học và file đề bài/slide của buổi học chỉ hiển thị sau khi học viên tự điểm danh (`studentChecked == true`).
  - Cập nhật link học cấp lớp (`meeting_link`) tự động áp dụng cho các buổi học tiếp theo.
  - Thẻ buổi học hiển thị hiệu ứng trực quan sinh động khi đến khung giờ dạy/học giúp gia sư và học viên dễ dàng nhận diện và tham gia.
- **Độ ổn định Backend & Frontend**:
  - Khắc phục lỗi biên dịch Java 21 trong `SessionAttendanceService.java` (`record AttendanceWithFiles` thay cho lambda closure không tương thích).
  - Toàn bộ backend `learning-service` (`BUILD SUCCESS`) và `frontend-web` (`npm run build`) biên dịch thành công 100% không có lỗi.

---

## 28/09/2026 — Chuẩn Hóa Khóa Nút Hủy Hợp Đồng, Tích Hợp AWS S3 Toàn Diện Cho Bài Tập & Tài Liệu Môn Học

- **Chuẩn hóa Điều kiện Hủy Hợp Đồng**:
  - Khóa chặt nút "Hủy hợp đồng": chỉ xuất hiện và cho phép bấm khi hợp đồng đang ở trạng thái `ACTIVE` (đã ký kết đầy đủ và thanh toán nạp cọc thành công).
  - Loại bỏ hoàn toàn fallback lấy hợp đồng chưa kích hoạt ở frontend (`TutorClassManagement.tsx`) và backend (`TerminationService.java`).
- **Kiến trúc Lưu trữ AWS S3 & CSDL Chuẩn hóa cho Learning Service**:
  - Tích hợp AWS SDK v2 S3 và `S3Presigner` vào `learning-service` (cấu hình `StorageProperties`, hỗ trợ cả S3 và Local Storage fallback).
  - Tạo bảng quan hệ chuẩn với khóa ngoại `ON DELETE CASCADE` (Flyway `V36__classroom_materials_and_session_files.sql`):
    - `classroom_materials`: Lưu trữ tài liệu môn học cấp lớp (`classes/{classId}/materials/`).
    - `session_files`: Lưu trữ file đề bài tập (`ASSIGNMENT`, tối đa 5 file/buổi) và file slide bài giảng (`MATERIAL`) theo từng buổi học (`classes/{classId}/sessions/{sessionId}/...`).
    - Bổ sung cột `syllabus_file_key`, `syllabus_file_name`, `syllabus_file_size` trên bảng `class_rooms` để lưu trữ giáo trình/lộ trình học.
    - Bổ sung cột `submission_s3_key`, `submission_file_name`, `submission_file_size` trên bảng `session_attendances` để lưu trữ bài nộp của học viên.
- **Phân định Quyền Truy cập Tài liệu & Bài tập Chặt chẽ**:
  - **Tài liệu môn học cấp lớp (`classroom_materials`)**: Học viên đã tham gia lớp (enrolled) và Gia sư có quyền xem và tải trực tiếp tài liệu về máy qua S3 presigned URL bất kỳ lúc nào mà **KHÔNG CẦN ĐIỂM DANH**.
  - **File Lộ trình học (Syllabus)**: Gia sư có thể tải lên file lộ trình/đề cương môn học khi tạo/sửa lớp; học viên có nút tải trực tiếp.
  - **Tài liệu & Đề bài tập theo từng buổi học (`session_files`)**: Học viên **BẮT BUỘC PHẢI ĐIỂM DANH (Check-in)** thì mới mở khóa xem nội dung đề bài và tải các file bài tập / slide bài giảng của buổi học đó (`studentChecked == true`).
  - **Nộp bài tập của học viên**: Học viên nộp bài làm bằng **file thật (lưu trữ trên S3)**; link ngoài chỉ là ghi chú bổ sung. Gia sư và học viên có nút tải file nộp từ S3 về máy bằng presigned URL bảo mật. Gia sư chấm điểm (thang điểm 0–10, Đạt/Chưa đạt) và gửi nhận xét chi tiết.
- **Bổ sung Mục Chuyên biệt trên Sidebar & Giao diện Quản lý Bài tập**:
  - **Sidebar Gia sư**: Thêm mục **"Quản lý bài tập"** (`/portal/tutor/homework`): quản lý bài tập theo lớp, buổi học, đính kèm tối đa 5 file đề bài & slide S3, xem danh sách bài nộp, tải file nộp của học viên từ S3 về máy và chấm điểm trực tiếp.
  - **Tính năng Xem lại toàn bộ Đề bài & Yêu cầu đã phân công cho Gia sư**:
    - Nhấn vào tiêu đề bài tập hoặc nút **"Xem đề bài"** mở modal chi tiết: xem đầy đủ tên bài, buổi học, yêu cầu/hướng dẫn ghi chú chi tiết không bị cắt ngắn, danh sách file đề bài và slide S3 kèm nút tải về máy.
    - Nút "Xem toàn bộ / Thu gọn" ngay trên thẻ bài tập.
    - Khung xem lại đề bài & file đính kèm tích hợp ngay trong modal "Xem & Chấm bài" giúp gia sư đối chiếu bài làm học sinh khi đang chấm.
  - **Sidebar Học viên**: Thêm mục **"Bài tập về nhà"** (`/portal/student/homework`): lọc theo lớp, hiển thị trạng thái hạn nộp, cảnh báo khóa nếu chưa điểm danh, modal nộp bài hỗ trợ chọn file S3 và tải về xem lại.
  - **Chi tiết lớp học**: Tích hợp component `ClassroomMaterialsSection.jsx` cho cả Học viên và Gia sư.
- **Kiểm thử tự động**:
  - Bổ sung 7 test cases chuyên sâu trong `SessionSecurityAndStorageTest.java`. Toàn bộ 81 test cases của `learning-service` pass 100%.
  - Frontend `npm run build` biên dịch thành công 100%.

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
- Điều chỉnh Messaging: backend chat persistence/API/WebSocket đã có; Phase 5.2 sau đó đã nối Web Messages vào dữ liệu thật cho Student/Tutor.
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
