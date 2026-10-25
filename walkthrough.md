# Walkthrough: Hoàn Thiện Giao Diện Lớp Học Của Tôi & Tính Năng Bài Tập Về Nhà / Điểm Danh Cho Học Viên & Gia Sư

Chúng ta đã hoàn thiện toàn bộ luồng hiển thị lịch học chi tiết, nộp bài tập về nhà và điểm danh trên cả Frontend và Backend mà không làm ảnh hưởng đến bất kỳ tính năng hay Smart Contract Escrow nào.

---

## 1. Các Thay Đổi Đã Thực Hiện

### 1.1. Backend (`learning-service`)
- **Database Migration (`V30__add_homework_submission_to_attendances.sql`)**:
  - Bổ sung các cột `submission_text`, `submission_file_url`, `submitted_at` vào bảng `session_attendances`.
- **Entity & DTOs**:
  - Cập nhật `SessionAttendance.java` với các trường bài nộp.
  - Cập nhật `ClassSessionDtos.java`:
    - `ClassSessionResponse` bổ sung `mySubmissionText`, `mySubmissionFileUrl`, `mySubmittedAt`.
    - `SessionAttendanceResponse` bổ sung `submissionText`, `submissionFileUrl`, `submittedAt`.
    - Thêm `SubmitHomeworkRequest(String submissionText, String submissionFileUrl)`.
- **Service & Controller**:
  - `SessionAttendanceService.java`: Thêm phương thức `submitHomework(sessionId, studentId, request)` cho phép học viên nộp bài tập sau khi đã check-in hoặc khi đã tham gia lớp.
  - `ClassSessionController.java`: Mở endpoint `POST /api/sessions/{sessionId}/homework-submission`.
- **Test Suite**: Đã chạy `mvn test` $\rightarrow$ **53/53 tests pass thành công (0 failure, 0 error)**.

---

### 1.2. Frontend (`frontend-web`)

#### A. Trang Lớp học của tôi (`StudentMyClassesPage.jsx`)
- Hiển thị card lớp học trực quan, đầy đủ thông tin:
  - **Huy hiệu Smart Contract Escrow Bảo Vệ** (thể hiện cọc Sepolia USDC minh bạch).
  - **Lịch học chi tiết trong tuần**: Thứ học và khung giờ (vd: `Thứ Ba & Thứ Năm • 07:00 - 08:30`).
  - **Quy mô & học phí**: Số buổi học, học phí theo buổi (USDC).
  - **Nút "Vào phòng học"** nhanh nếu gia sư đã cấu hình meeting link (Google Meet / Zoom / MS Teams).
  - **Accordion mở rộng timeline chi tiết** chứa toàn bộ các buổi học cuốn chiếu.

#### B. Component Tiến trình buổi học (`ClassSessionsTimeline.tsx`)
- **Khóa / Mở khóa Bài tập theo Điểm danh (Gated by Attendance)**:
  - Học viên trước khi điểm danh trong giờ: Bài tập hiển thị ở trạng thái khóa (Lock) cùng hướng dẫn điểm danh trong khung giờ học để mở khóa.
  - Sau khi học viên điểm danh thành công: Bài tập được mở khóa ngay lập tức cùng với đề bài, tài liệu đính kèm của gia sư.
- **Nộp bài tập về nhà (Student Homework Submission Modal)**:
  - Học viên có thể nhập nội dung bài giải (text) và dán link file/ảnh bài làm (Google Drive, Imgur, OneDrive, v.v.).
  - Hiển thị trạng thái "Đã nộp bài" kèm thời gian nộp, snippet bài giải và link xem file/hình ảnh.
  - Cho phép học viên bấm "Sửa / Nộp lại" khi cần cập nhật.
- **Gia sư duyệt bài tập của học sinh (Tutor Attendance & Homework Roster)**:
  - Trong modal "Xem Danh Sách Lớp", gia sư có thể theo dõi danh sách điểm danh và xem trực tiếp học viên nào đã nộp bài tập.
  - Gia sư có nút bấm "Xem bài nộp" để xem nhanh nội dung lời giải và mở trực tiếp link file/hình ảnh bài nộp của từng học sinh trong tab mới.

---

## 2. Kiểm Thử & Xác Nhận (Verification)
1. **Backend Tests**: `53/53` unit & integration tests trong `learning-service` pass (Bao gồm các test lịch học, điểm danh, authorization, conflict detection, v.v.).
2. **Frontend Build**: Lệnh `npm run build` chạy thành công (Vite compile không có lỗi TypeScript / JSX).
3. **Smart Contract Escrow & Database**: Hợp đồng và lớp học thật trên Sepolia (`0x3cafb9035e00c71030b1565be44eec51e22f734e6bbda6b6038522c25aab1e44` - $4.80 USDC) giữ nguyên trạng thái `ACTIVE` / `ENROLLED` và bảo lưu an toàn.

---

## 3. Xác Thực Toàn Diện Hệ Thống Trên VPS Production (2026-10-23)

Toàn bộ hệ thống EduConnect đã được kiểm chứng end-to-end trên môi trường production thực tế tại VPS `103.74.100.232` domain `https://educonnectiuh.duckdns.org`.

### 3.1. Hiện trạng triển khai hạ tầng
- **Tổng số container**: `12/12` container đều đang ở trạng thái `Up` (trong đó 5 core services có healthcheck báo `healthy`: postgres, rabbitmq, gotenberg, gateway, web).
- **Cấu hình Blockchain**:
  - `BLOCKCHAIN_ENABLED=true`
  - `BLOCKCHAIN_OPERATOR_ENABLED=true`
  - Ví Operator: `0x10dd719B6a13e9d275990d706C2640ab6F1CA28e` (Số dư Sepolia ETH để trả gas).
  - Escrow Smart Contract (Sepolia): `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`
  - USDC Token (Sepolia): `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Cấu hình AI**: Profile `ai` đã được kích hoạt, gồm container `qdrant` (port 6333) và `ai-service` (port 8085 kết nối Google Gemini API).

### 3.2. Bằng chứng kiểm chứng Database thực tế
Tại thời điểm 2026-10-23, lệnh truy vấn trực tiếp vào PostgreSQL production trên VPS xác nhận:
```sql
-- 1. Lớp học Toán 10 (#41)
SELECT id, name, status, start_date FROM class_rooms WHERE id = 41;
-- Kết quả: id: 41 | name: 'Toán lớp 10 (001-2026)' | status: PUBLISHED | start_date: 2026-10-24

-- 2. Buổi học: 0 rows (sạch sẽ, lớp khai giảng ngày 2026-10-24 nên chưa có buổi nào bị hoàn tất sai)
SELECT id, class_room_id FROM class_sessions WHERE class_room_id = 41;

-- 3. Đơn ghi danh học viên
SELECT id, class_room_id, status, agreement_id FROM enrollment_requests WHERE class_room_id = 41;
-- Kết quả: id: 1 | status: ENROLLED | agreement_id: 2aeca99d-2584-457f-912d-93262f3c509b

-- 4. Hợp đồng ký quỹ Escrow
SELECT id, classroom_id, status FROM contract_agreement WHERE classroom_id = 41;
-- Kết quả: id: 2aeca99d-2584-457f-912d-93262f3c509b | classroom_id: 41 | status: ACTIVE

-- 5. Bằng chứng giao dịch Ký quỹ Escrow (LOCKED 4.80 USDC)
SELECT agreement_id, status, expected_amount, fund_tx_hash, confirmed_block_number FROM escrow_payment WHERE agreement_id = '2aeca99d-2584-457f-912d-93262f3c509b';
-- Kết quả: status: LOCKED | expected_amount: 4800000 (4.80 USDC) | block: 11977570
-- Fund Tx Hash: 0xcbac14e5adf8ed03fa1e2162ea0182dbfb93ab19d3640d1d2e21aeaa21a37e4b
-- Etherscan: https://sepolia.etherscan.io/tx/0xcbac14e5adf8ed03fa1e2162ea0182dbfb93ab19d3640d1d2e21aeaa21a37e4b

-- 6. Bằng chứng giao dịch Operator Ghi nhận Hợp đồng on-chain (CONFIRMED)
SELECT action, transaction_hash, block_number, status FROM blockchain_transaction WHERE agreement_id = '2aeca99d-2584-457f-912d-93262f3c509b';
-- Kết quả: action: REGISTER | status: CONFIRMED | block: 11977533
-- Operator Tx Hash: 0xe7f05126b92ff47aeee8466d7fead9852f753432684b4b512f07b1a3b0dcf684
-- Etherscan: https://sepolia.etherscan.io/tx/0xe7f05126b92ff47aeee8466d7fead9852f753432684b4b512f07b1a3b0dcf684
```

### 3.3. Các mốc Milestone đã hoàn tất và kiểm chứng
1. **Milestone 1 (Auth & Account)**: Đăng nhập HttpOnly JWT Cookie, chuyển đổi vai trò Học viên / Gia sư, bảo vệ CSRF.
2. **Milestone 2 (Chat & Realtime)**: WebSocket (`/ws/chat`) kết nối qua Gateway & Caddy, trao đổi tin nhắn tức thời và upload tài liệu S3.
3. **Milestone 3 (Lớp học & Hợp đồng Web3 Escrow)**:
   - Học viên nộp đơn $\rightarrow$ Gia sư chấp thuận.
   - Ký số song phương EIP-712 off-chain qua MetaMask (không tốn gas).
   - Ví Operator ghi nhận hợp đồng on-chain trên Sepolia (`registerAgreement`).
   - Học viên ký quỹ thành công bằng USDC vào Smart Contract Escrow trên mạng Sepolia testnet (`fundAgreement` / `deposit`).
   - Hợp đồng chuyển sang `ACTIVE`, học viên chuyển sang `ENROLLED`.
4. **Milestone 4 (Phân hệ AI Trợ lý học tập)**:
   - Bật thành công profile `ai` (`qdrant` và `ai-service`).
   - Tích hợp Widget Chatbot AI tại góc phải màn hình web.
5. **Vá lỗi kết nối Outbox RabbitMQ**:
   - Khắc phục lỗi `localhost:5672` bằng cách bổ sung `SPRING_RABBITMQ_HOST: rabbitmq` vào `contract-service` trong `compose.vps.yaml`.

---

## 4. Tự Động Hóa CI/CD Toàn Trình (Full Auto-CD), Kích Hoạt Bảo Vệ Nhánh Main & Phân Định Khóa Bảo Mật (2026-10-25)

Ngày 25/10/2026, toàn bộ quy trình CI/CD và triển khai tự động lên Production VPS đã được thiết lập hoàn tất, chuẩn hóa thành quy trình làm việc nhóm 2 người tối ưu, an toàn và chuyên nghiệp.

### 4.1. Kiến Trúc & Luồng Vận Hành Auto-CD Nhóm 2 Người
```
[Thành viên nhóm] 
       │ Tạo branch tính năng & code
       ▼
[Mở Pull Request vào main]
       │
       ├─► GitHub Actions chạy `CI gate` (ci.yml: 982 tests backend + build frontend-web)
       │
       ▼ (Chờ review)
[Chủ repo / Đồng đội Review & Approve] (Branch Protection yêu cầu 1 approval)
       │
       ▼
[Merge vào nhánh main]
       │
       ▼
[GitHub Actions: publish-images.yml]
       ├─► Build & Push 7 Docker images với tag commit SHA lên GHCR (ghcr.io/thaiquo/...)
       │
       └─► Job `deploy-production`:
             ├─ Nạp SSH Key `VPS_SSH_KEY` & kiểm tra host fingerprint `VPS_KNOWN_HOSTS`
             ├─ Đồng bộ cấu hình triển khai (`compose.vps.yaml`, `deploy/Caddyfile`)
             └─ SSH vào VPS gọi: `sudo -n /usr/local/sbin/educonnect-release deploy <SHA>`
                   │
                   ▼ (Trên VPS 103.74.100.232)
             [Bộ điều phối Release: educonnect-release]
                   ├─ Preflight: Kiểm tra Docker, bộ nhớ đĩa (> 3 GiB), Compose config
                   ├─ Snapshot rollback: Lưu danh sách image hiện tại làm mục tiêu rollback
                   ├─ Database Safety: Tự động backup PostgreSQL vào `/var/backups/educonnect`
                   ├─ Image Pull: Tải 7 images mới tương ứng đúng mã commit SHA
                   ├─ Khởi động dịch vụ: `docker compose ... --profile ai up -d --wait`
                   ├─ Healthcheck: Xác thực 12/12 containers UP và healthy
                   └─ Smoke test: Gửi HTTP request kiểm tra `/healthz` và `/api/classes/search` (HTTP 200)
```

### 4.2. Kết Quả Kiểm Chứng Thực Tế Lần Triển Khai Đầu Tiên
- **Mã commit release**: `b57a37c` (merge từ PR `chore/automatic-cd`).
- **Trạng thái GitHub Actions**: Workflow `CI gate` và `Publish and deploy production images` đều xanh 100%.
- **Trạng thái trên VPS (`103.74.100.232`)**:
  - Đủ **12/12 container** chạy ổn định: `postgres`, `rabbitmq`, `gotenberg`, `caddy`, `qdrant`, `api-gateway`, `account-service`, `learning-service`, `contract-service`, `notification-service`, `ai-service`, `frontend-web`.
  - Phản hồi công khai: `https://educonnectiuh.duckdns.org/healthz` $\rightarrow$ `HTTP 200`.
  - API công khai: `https://educonnectiuh.duckdns.org/api/classes/search` $\rightarrow$ `HTTP 200` (trả về danh sách lớp học thực tế).

### 4.3. Quy Tắc Bảo Vệ Nhánh Main (Classic Branch Protection)
Đã kích hoạt trên GitHub Repository (gói GitHub Pro / Student Pack):
1. **Require a pull request before merging**: Bắt buộc mọi thay đổi vào `main` phải qua PR.
2. **Require approvals: 1**: Bắt buộc có 1 thành viên review và approve (không cho tác giả tự duyệt PR của chính mình).
3. **Dismiss stale pull request approvals**: Khi có commit mới đẩy lên PR, lượt duyệt trước sẽ tự động hủy để review lại.
4. **Require status checks to pass before merging**: Bắt buộc job **`CI gate`** phải PASS mới được merge.
5. **Require branches to be up to date before merging**: Nhánh tính năng phải rebase/merge code mới nhất của `main` trước khi hòa mạng.
6. **Do not allow bypassing the above settings**: Ngay cả Admin/Chủ repo cũng phải tuân thủ nghiêm ngặt quy trình PR.
7. **Allow force pushes / Allow deletions**: Đã **TẮT** hoàn toàn để ngăn chặn mất mát mã nguồn.

### 4.4. Phân Định Rõ Ràng & Triệt Để Các Loại Khóa Bảo Mật (Tránh Nhầm Lẫn)
Bảng đối chiếu tuyệt đối giữa các loại thông tin bảo mật trong hệ thống để tránh tình trạng AI hay lập trình viên bị nhầm lẫn:

| Tiêu chí | Khóa Ví Web3 Operator (`BLOCKCHAIN_OPERATOR_PRIVATE_KEY`) | Khóa Mạng Deploy SSH (`VPS_SSH_KEY`) | Mật khẩu / Khóa CSDL & Dịch vụ (`.env`) | Khóa Ví Người dùng (Metamask EIP-712) |
| :--- | :--- | :--- | :--- | :--- |
| **Bản chất** | Private key ví Ethereum / Sepolia (`0x10dd...`) | Cặp khóa mã hóa SSH Ed25519 (`educonnect-gh-actions`) | Chuỗi bí mật cấu hình hệ điều hành / runtime | Private key ví cá nhân học viên / gia sư |
| **Mục đích** | Ký giao dịch Smart Contract Escrow (trả gas, đăng ký hợp đồng, giải ngân payout) | Cho phép GitHub Actions SSH vào VPS kích hoạt lệnh release script | Kết nối CSDL Postgres, RabbitMQ, JWT signing, S3, Gemini API | Ký duyệt thỏa thuận học tập ngoài chuỗi (EIP-712 Typed Data) |
| **Nơi lưu trữ** | **DUY NHẤT** trong file `/opt/educonnect/.env` trên VPS | Private Key lưu tại **GitHub Secrets `VPS_SSH_KEY`**; Public Key lưu tại `~/.ssh/authorized_keys` trên VPS | **DUY NHẤT** trong file `/opt/educonnect/.env` trên VPS | Lưu an toàn trong ví MetaMask trên trình duyệt của người dùng |
| **Cơ chế nạp** | Đọc qua biến môi trường `BLOCKCHAIN_OPERATOR_PRIVATE_KEY` (Spring Boot tự tạo `Credentials`) | Đọc qua SSH client trong GitHub Actions runner | Đọc qua Spring Boot `@Value` và compose environment | Người dùng tự xác nhận qua popup tiện ích mở rộng MetaMask |
| **Có đưa lên GitHub không?** | **TUYỆT ĐỐI KHÔNG** | Chỉ đưa SSH Private Key vào GitHub Secrets | **TUYỆT ĐỐI KHÔNG** | **TUYỆT ĐỐI KHÔNG** |
| **Có dùng Keystore file không?** | **KHÔNG CẦN**. Hiện tại VPS dùng raw private key trực tiếp trong `.env` gọn gàng, không cần mount file keystore | Không liên quan | Không liên quan | Không liên quan |

