# 📘 TÀI LIỆU ĐẶC TẢ TOÀN DIỆN KIẾN TRÚC & QUY TRÌNH NGHIỆP VỤ HỆ THỐNG EDUCONNECT

> **Tài liệu bàn giao & Báo cáo kỹ thuật Khóa Luận Tốt Nghiệp**  
> Dành cho người đọc, giảng viên hướng dẫn, hội đồng phản biện và lập trình viên tiếp nhận dự án.

---

## 📑 MỤC LỤC
1. [Giới thiệu dự án & Mục tiêu giải quyết](#1-giới-thiệu-dự-án--mục-tiêu-giải-quyết)
2. [Bản đồ Kiến trúc Microservices (Architecture Map)](#2-bản-đồ-kiến-trúc-microservices-architecture-map)
3. [Chi tiết các Phân hệ Dịch vụ (Service Domain Breakdown)](#3-chi-tiết-các-phân-hệ-dịch-vụ-service-domain-breakdown)
4. [Đặc tả Luồng Nghiệp Vụ Chuẩn (End-to-End Workflows)](#4-đặc-tả-luồng-nghiệp-vụ-chuẩn-end-to-end-workflows)
5. [Kiến trúc Hợp đồng Thông minh & Ký số Web3 (Smart Contract Escrow & EIP-712)](#5-kiến-trúc-hợp-đồng-thông-minh--ký-số-web3-smart-contract-escrow--eip-712)
6. [Mô hình Dữ liệu & Bảng cơ sở dữ liệu cốt lõi (Database Schema)](#6-mô-hình-dữ-liệu--bảng-cơ-sở-dữ-liệu-cốt-lõi-database-schema)
7. [Cơ chế Phục hồi & Xử lý ngoại lệ (Fault Tolerance & Resilience)](#7-cơ-chế-phục-hồi--xử-lý-ngoại-lệ-fault-tolerance--resilience)
8. [Checklist Tính Năng Đã Hoàn Thành 100%](#8-checklist-tính-năng-đã-hoàn-thành-100)

---

## 1. GIỚI THIỆU DỰ ÁN & MỤC TIÊU GIẢI QUYẾT

### 1.1. Bối cảnh
Thị trường giáo dục gia sư trực tuyến truyền thống đối mặt với 3 vấn đề nhức nhối:
1. **Rủi ro niềm tin (Trust deficit)**: Học viên trả trước tiền cả khóa thì sợ gia sư dạy 1-2 buổi rồi biến mất hoặc dạy hời hợt; nếu trả sau thì gia sư sợ học viên quỵt tiền sau khi học xong.
2. **Thiếu cơ sở pháp lý và chứng cứ**: Các thỏa thuận chủ yếu qua tin nhắn Zalo/Facebook, không có hợp đồng có hiệu lực pháp lý và không có nhật ký điểm danh bảo chứng.
3. **Phí trung gian cao & thanh toán cồng kềnh**: Các trung tâm môi giới truyền thống cắt phế từ 30% – 50% tiền lương của gia sư.

### 1.2. Giải pháp EduConnect
EduConnect ứng dụng **Công nghệ Blockchain & Chữ ký số EIP-712** để xây dựng mô hình **Ký quỹ phi tập trung (Escrow)**:
- **Ký hợp đồng pháp lý**: Văn bản điện tử đối soát 2 chiều, ký bằng khóa riêng tư ví Web3 (MetaMask) theo chuẩn EIP-712.
- **Khóa tiền học phí**: Tiền nạp cọc (USDC) được giữ an toàn tuyệt đối trong Smart Contract `EduConnectEscrow`, không ai (kể cả admin) có thể tự ý chiếm đoạt.
- **Tự động giải ngân theo từng buổi**: Sau mỗi buổi học được điểm danh xác nhận, Smart Contract tự động chuyển **85%** cho Gia sư và **15%** cho Nền tảng.
- **Cơ chế khiếu nại minh bạch**: Học viên có 24 giờ sau buổi học để khiếu nại nếu gia sư vắng mặt hoặc vi phạm cam kết, với trọng tài giải quyết dựa trên nhật ký bằng chứng.

---

## 2. BẢN ĐỒ KIẾN TRÚC MICROSERVICES (ARCHITECTURE MAP)

Hệ thống được chia tách thành 4 dịch vụ độc lập giao tiếp qua REST API và Message Broker:

```
                                      [Client Apps]
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
             [Web Frontend (Vite)]                       [MetaMask / Web3 Wallet]
                     │                                             │
                     ▼                                             ▼
        [API Gateway (Spring Cloud - 8080)]             [Ethereum Sepolia Testnet]
                     │                                  (Master Escrow & Circle USDC)
       ┌─────────────┼─────────────┐                               ▲
       ▼             ▼             ▼                               │
[account-service] [learning-service] [contract-service]─────────────┘
  (Port 8081)      (Port 8082)       (Port 8084)
       │             │                 │
       └─────────────┼─────────────────┘
                     ▼
             [RabbitMQ (5672)]
                     │
                     ▼
        [PostgreSQL Database (5434)]
```

---

## 3. CHI TIẾT CÁC PHÂN HỆ DỊCH VỤ (SERVICE DOMAIN BREAKDOWN)

### 3.1. API Gateway (`backend/api-gateway` - Port 8080)
- Định tuyến ngược (Reverse Proxy) toàn bộ request từ frontend đến các service nội bộ:
  - `/api/auth/**`, `/api/users/**`, `/api/tutors/**` -> `account-service` (8081)
  - `/api/learning/**`, `/api/subjects/**`, `/api/classes/**` -> `learning-service` (8082)
  - `/api/contracts/**`, `/api/escrow/**` -> `contract-service` (8084)
- Xử lý CORS tập trung, bảo vệ cổng vào duy nhất cho toàn hệ thống.

### 3.2. Account Service (`backend/account-service` - Port 8081)
- **Xác thực & Phân quyền**: Đăng ký, Đăng nhập, Quên mật khẩu qua OTP Email (`javax.mail`), JWT Auth lưu trong HttpOnly Cookie an toàn chống XSS.
- **Quản lý Hồ sơ & KYC Gia sư**:
  - Đăng ký hồ sơ gia sư, tải bằng cấp / chứng chỉ / CCCD lên **AWS S3**.
  - Dashboard cho Nhân viên (Staff) kiểm duyệt, phê duyệt môn dạy và đặt giá sàn.
- **Quản lý Địa chỉ Ví Web3**: Lưu trữ và cập nhật ví MetaMask của từng người dùng.

### 3.3. Learning Service (`backend/learning-service` - Port 8082)
- **Quản lý Môn học & Danh mục**: Cây phân cấp môn học (Toán, Lý, Hóa, Ngoại ngữ, Lập trình...).
- **Quản lý Lớp học (Classroom)**:
  - Gia sư tạo lớp học (Hình thức học Online/Offline, Lịch học cố định, Thời lượng, Học phí theo buổi, Giới hạn sĩ số).
  - Tìm kiếm, lọc và phân trang lớp học ngoài trang chủ.
- **Quản lý Yêu cầu Ghi danh (Enrollment Requests)**:
  - Học viên gửi yêu cầu tham gia lớp.
  - Phân tách 2 cấp độ quyền:
    - `ACCEPTED`: Gia sư đã đồng ý, học viên được **giữ chỗ** (`reservedSlot`), nhưng **chưa có link phòng học**.
    - `ENROLLED`: Hợp đồng đã nạp cọc `ACTIVE`, học viên chính thức có tên trong lớp và được cấp **link phòng học Google Meet / Zoom**.
- **Điểm danh & Nhật ký buổi học (Attendance & Sessions)**:
  - Gia sư tạo buổi học, điểm danh có mặt/vắng mặt.
  - Đồng bộ trạng thái buổi học sang `contract-service` để mở quyết toán.

### 3.4. Contract Service (`backend/contract-service` - Port 8084)
- **Soạn thảo & Snapshot điều khoản (`terms_json`)**: Đóng băng toàn bộ thỏa thuận (tên lớp, học phí, lịch học, ví 2 bên) thành mã băm `terms_hash` không thể sửa đổi.
- **Xác thực Chữ ký điện tử EIP-712 (`Eip712VerificationService`)**: Kiểm tra chữ ký mật mã thật từ ví MetaMask.
- **Quản lý Vòng đời Hợp đồng (`ContractAgreementStatus`)**:
  - `DRAFT` -> `PENDING_TUTOR_ACCEPTANCE` -> `PENDING_STUDENT_ACCEPTANCE` -> `WAITING_PAYMENT` -> `ACTIVE` -> `COMPLETED`.
  - Tiến trình ngầm `ContractExpirationScheduler`: Tự động quét và hủy các hợp đồng quá hạn 24 giờ chưa nạp cọc (`EXPIRED`).
- **Xuất bản Văn bản Hợp đồng Pháp lý (`ContractDocumentArtifactService`)**: Tự động sinh file **Microsoft Word (.docx)** và **PDF** đính kèm con dấu chữ ký điện tử EIP-712 của cả 2 bên.

---

## 4. ĐẶC TẢ LUỒNG NGHIỆP VỤ CHUẨN (END-TO-END WORKFLOWS)

### Luồng 1: Học viên đăng ký học & Ký kết hợp đồng Escrow
1. **Tìm & Chọn lớp**: Học viên tìm lớp phù hợp trên Marketplace và bấm *"Gửi yêu cầu học"*.
2. **Gia sư duyệt & Khởi tạo hợp đồng**:
   - Gia sư vào mục *"Yêu cầu học viên"*, bấm *"Xem & Ký Hợp đồng"*.
   - Hệ thống khởi tạo hợp đồng `#agreementId`, snapshot toàn bộ điều khoản vào `terms_json` và sinh ra `terms_hash`.
   - Gia sư bấm ký -> MetaMask bật popup EIP-712 -> Lưu chữ ký Bên A.
3. **Học viên kiểm tra & Ký xác nhận**:
   - Học viên mở modal *"Văn bản hợp đồng điện tử"*, đọc toàn bộ 8 điều khoản pháp lý.
   - Học viên bấm *"Ký số EIP-712 (MetaMask)"* -> Lưu chữ ký Bên B.
   - Hợp đồng chuyển sang `WAITING_PAYMENT` với thời hạn nạp cọc 24 giờ.
4. **Học viên Ký quỹ (Escrow Deposit)**:
   - Học viên bấm *"Ký quỹ $X USDC"*.
   - Bước 1: `Approve` quyền chi tiêu USDC cho Smart Contract Escrow.
   - Bước 2: Giao dịch chuyển tiền cọc USDC thật vào Smart Contract Escrow trên mạng Sepolia.
5. **Kích hoạt Lớp học**:
   - Giao dịch được xác nhận trên Blockchain Sepolia (sinh ra TxHash thật).
   - `contract-service` chuyển trạng thái sang `ACTIVE`.
   - `learning-service` nhận sự kiện, chuyển yêu cầu học viên thành `ENROLLED` và mở toàn quyền vào phòng học.

---

### Luồng 2: Dạy học, Điểm danh & Tự động Quyết toán từng buổi
1. Đến giờ học, Gia sư và Học viên bấm vào link phòng học Google Meet / Zoom đã được cấp.
2. Kết thúc buổi học, Gia sư bấm *"Điểm danh buổi học"* (Học viên có mặt).
3. Hệ thống tạo bản ghi quyết toán buổi học (`SessionSettlement`), mở khung giờ khiếu nại **24 giờ**.
4. **Sau 24 giờ**:
   - Nếu học viên **không có khiếu nại**: Hệ thống tự động giải ngân: **85%** USDC về ví Gia sư, **15%** USDC về ví Sàn.
   - Nếu học viên **bấm Mở khiếu nại**: Tiền buổi học tạm khóa, Trọng tài (Staff/Admin) vào phân xử dựa trên chứng cứ nhật ký.

---

## 5. KIẾN TRÚC HỢP ĐỒNG THÔNG MINH & KÝ SỐ WEB3 (SMART CONTRACT ESCROW & EIP-712)

### 5.1. Cấu trúc Smart Contract `EduConnectEscrow.sol`
- **Địa chỉ Deploy trên Sepolia**: `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`
- **Địa chỉ Token USDC (Circle Mock)**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Các quyền quản trị (Role-Based Access Control)**:
  - `DEFAULT_ADMIN_ROLE`: Quản trị viên cấp cao.
  - `OPERATOR_ROLE`: Backend Server thực hiện đăng ký và quyết toán buổi học.
  - `ARBITRATOR_ROLE`: Trọng tài phân xử tranh chấp.

### 5.2. Cấu trúc Dữ liệu Chữ ký EIP-712 (`EIP-712 Domain & Types`)
```json
{
  "types": {
    "EIP712Domain": [
      { "name": "name", "type": "string" },
      { "name": "version", "type": "string" },
      { "name": "chainId", "type": "uint256" },
      { "name": "verifyingContract", "type": "address" }
    ],
    "AgreementTerms": [
      { "name": "agreementId", "type": "string" },
      { "name": "tutorWallet", "type": "address" },
      { "name": "studentWallet", "type": "address" },
      { "name": "totalAmountUsdc", "type": "uint256" },
      { "name": "termsHash", "type": "string" },
      { "name": "createdAt", "type": "string" }
    ]
  }
}
```

---

## 6. MÔ HÌNH DỮ LIỆU & BẢNG CƠ SỞ DỮ LIỆU CỐT LÕI (DATABASE SCHEMA)

### Các bảng chính trong cơ sở dữ liệu `kltn_db`:

1. **`contract_agreement`**:
   - `id` (UUID - Khóa chính)
   - `classroom_id`, `student_id`, `tutor_id`
   - `student_wallet`, `tutor_wallet`
   - `total_amount_usdc_units`, `price_per_session_usdc_units`, `total_sessions`
   - `terms_json`, `terms_hash`, `contract_version`
   - `status` (`DRAFT`, `PENDING_TUTOR_ACCEPTANCE`, `PENDING_STUDENT_ACCEPTANCE`, `WAITING_PAYMENT`, `PAYMENT_CONFIRMING`, `ACTIVE`, `COMPLETED`, `EXPIRED`, `CANCELLED`)
   - `payment_deadline_at`, `activated_at`

2. **`contract_acceptance`**:
   - `id` (UUID - Khóa chính)
   - `agreement_id`, `user_id`, `role` (`TUTOR` | `STUDENT`)
   - `wallet_address`, `signature` (Chữ ký hex 130/132 chars), `terms_hash`
   - `accepted_at`, `ip_address`, `user_agent`

3. **`escrow_payment`**:
   - `id` (UUID - Khóa chính)
   - `agreement_id`, `student_wallet`, `escrow_contract_address`
   - `total_amount_units`, `status` (`INITIATED`, `LOCKED`, `SETTLED`, `REFUNDED`)
   - `fund_tx_hash` (TxHash trên Sepolia), `funded_at`

4. **`class_enrollment_requests`**:
   - `id` (Long - Khóa chính)
   - `classroom_id`, `student_id`, `agreement_id`
   - `status` (`PENDING`, `ACCEPTED`, `REJECTED`, `ENROLLED`, `CANCELLED`)

5. **`class_enrollments`**:
   - `id`, `classroom_id`, `student_id`, `enrolled_at`, `status` (`ACTIVE`)

---

## 7. CƠ CHẾ PHỤC HỒI & XỬ LÝ NGOẠI LỆ (FAULT TOLERANCE & RESILIENCE)

1. **Fallback Nạp Ký Quỹ Thông Minh**:
   - Khi mạng Sepolia bị nghẽn hoặc giao dịch `fundAgreement` bị trễ đăng ký: Hệ thống tự động chuyển sang cơ chế chuyển USDC trực tiếp vào địa chỉ Smart Contract Escrow để đảm bảo giao dịch của học viên luôn thành công 100%.
2. **Kênh Đồng Bộ Kép (Dual-channel Activation)**:
   - Kích hoạt hợp đồng vừa gửi trực tiếp qua REST API nội bộ, vừa gửi qua hàng đợi **RabbitMQ Outbox (`contract.activated.v1`)**. Nếu một kênh gặp sự cố mạng, kênh còn lại sẽ bù trừ ngay lập tức.
3. **Cơ chế Tự Động Làm Mới Giao Diện Thời Gian Thực (Global Event Auto-Refresh)**:
   - Khi có bất kỳ thay đổi nào (Ký số, Nạp cọc, Quyết toán): Toàn bộ màn hình của người dùng tự động làm mới dữ liệu không cần F5 thủ công.

---

## 8. CHECKLIST TÍNH NĂNG ĐÃ HOÀN THÀNH 100%

| Phân hệ | Chức năng | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **Account** | Đăng ký, Đăng nhập, Quên mật khẩu, OTP Email | ✅ Hoàn thành | HttpOnly Cookie JWT |
| **Account** | Nộp hồ sơ gia sư, tải bằng cấp S3, duyệt hồ sơ Staff | ✅ Hoàn thành | Phân quyền ADMIN/STAFF |
| **Learning** | Tạo lớp, cấu hình lịch học, giới hạn sĩ số | ✅ Hoàn thành | Tìm kiếm & lọc nâng cao |
| **Learning** | Gửi yêu cầu học, Giữ chỗ (ACCEPTED) vs Vào lớp (ENROLLED) | ✅ Hoàn thành | Tách biệt quyền bảo mật |
| **Contract** | Soạn thảo hợp đồng, snapshot điều khoản JSON & Hash | ✅ Hoàn thành | Bất biến (Immutable) |
| **Contract** | Ký số EIP-712 Gia sư & Học viên qua MetaMask | ✅ Hoàn thành | Mã hóa chữ ký thật |
| **Contract** | Xuất bản văn bản hợp đồng pháp lý Microsoft Word & PDF | ✅ Hoàn thành | Docx4j & OpenPDF |
| **Contract** | Tự động hủy hợp đồng quá hạn 24 giờ (`EXPIRED`) | ✅ Hoàn thành | Cron Scheduler ngầm |
| **Web3 / Escrow** | Nạp cọc USDC Sepolia vào Master Smart Contract | ✅ Hoàn thành | Circle USDC & Etherscan |
| **Escrow** | Điểm danh & Tự động quyết toán 85% - 15% | ✅ Hoàn thành | Khung khiếu nại 24h |
| **Escrow** | Phân xử khiếu nại tranh chấp (Dispute Panel) | ✅ Hoàn thành | Trọng tài Sàn |

---
*Tài liệu này là căn cứ kỹ thuật chính thức của dự án Khóa Luận Tốt Nghiệp EduConnect.*
