# 📘 EDUCONNECT — ĐẶC TẢ KIẾN TRÚC & KẾ HOẠCH TỔNG THỂ BUỔI HỌC, ĐIỂM DANH & QUYẾT TOÁN ESCROW

> **Tài liệu Kế hoạch Triển khai Master (Master Implementation Plan)**  
> **Phân hệ**: Quản lý Buổi học cuốn chiếu (Rolling Sessions), Link phòng học lớp chung, Bài tập/Tài liệu từng buổi, Điểm danh trong thời gian học & Tự động Giải ngân Smart Contract Escrow.  
> **Tài liệu đối soát gốc**: `Plan/EDUCONNECT_BLOCKCHAIN_MASTER_ESCROW_IMPLEMENTATION_GUIDE.md` (Mục 10, 11, 12).  
> **Áp dụng cho**: `learning-service`, `contract-service`, `notification-service`, `frontend-web`.

---

## 📑 MỤC LỤC
1. [Mục tiêu & Nguyên tắc Thiết kế](#1-mục-tiêu--nguyên-tắc-thiết-kế)
2. [Cơ chế Link Phòng Học Lớp & Giao Bài Tập](#2-cơ-chế-link-phòng-học-lớp--giao-bài-tập)
3. [Cơ chế Tự động Khóa Lớp theo Ngày Khai giảng (Classroom Auto-Lock)](#3-cơ-chế-tự-động-khóa-lớp-theo-ngày-khai-giảng-classroom-auto-lock)
4. [Cơ chế Điểm Danh Độc Lập & Mở Khóa Bài Tập Thông Minh](#4-cơ-chế-điểm-danh-độc-lập--mở-khóa-bài-tập-thông-minh)
5. [Cơ chế Tự Động Hoàn Tất Buổi Học Khi Hết Giờ](#5-cơ-chế-tự-động-hoàn-tất-buổi-học-khi-hết-giờ)
6. [Quy trình Khiếu Nại 24h & Phân Quyền Trọng Tài Chuẩn Master Guide](#6-quy-trình-khiếu-nại-24h--phân-quyền-trọng-tài-chuẩn-master-guide)
7. [Kiến trúc Dữ liệu & Ràng buộc Quan hệ (Database Architecture)](#7-kiến-trúc-dữ-liệu--ràng-buộc-quan-hệ-database-architecture)
8. [Cơ chế Smart Contract Escrow & Quy tắc Giải ngân](#8-cơ-chế-smart-contract-escrow--quy-tắc-giải-ngân)

---

## 1. MỤC TIÊU & NGUYÊN TẮC THIẾT KẾ

### 1.1. Mục tiêu
- **Link phòng học cố định theo Lớp học (`class_rooms.meeting_link`):** Học viên và Gia sư dùng chung 1 đường link Google Meet / Zoom / Teams xuyên suốt lớp học. Khi có sự cố đổi phòng, Gia sư chỉ cần cập nhật link của Lớp học là toàn bộ học viên nhận được ngay.
- **Quản lý Bài tập & File Tài liệu theo Từng Buổi (`class_sessions`):** Mỗi buổi học là một không gian riêng để Gia sư:
  - Soạn thảo chủ đề buổi học (`topic`), giao bài tập (`assignment`), đính kèm file tài liệu / bài giảng từ nhiều ngày trước.
  - Theo dõi **Danh sách Điểm danh chi tiết** của toàn bộ học viên trong buổi đó (ai đã check-in, ai chưa).
- **Điểm danh chuẩn xác TRONG THỜI GIAN HỌC:** Chỉ cho phép Check-in trong đúng khung giờ `[start_time, end_time]` của ngày `session_date` (ví dụ: đúng từ `19:00` đến `20:30`).
- **Mở khóa bài tập theo điểm danh (Gated Assignment Access):** Học viên phải bấm điểm danh vào học mới được mở khóa đề bài và link tải file tài liệu đính kèm.
- **Tự động hoàn tất buổi học:** Khi kết thúc giờ học thực tế (`now >= endTime`), hệ thống tự động hoàn tất và chốt kết quả, không bắt gia sư phải bấm lưu thủ công.
- **Chống phình to Database (Rolling Sessions):** Sinh cuốn chiếu 1 tuần đầu (ví dụ: 3 buổi), khi buổi cuối tuần hoàn thành thì tự động sinh tiếp tuần tiếp theo.
- **Quyết toán Escrow & Khiếu nại đúng chuẩn:** Bắn sự kiện sang `contract-service` để gọi `proposeSessionSettlement`, mở cửa sổ khiếu nại 24h (`disputeDeadline`), xử lý khiếu nại cá nhân hóa theo từng `agreementId`.

---

## 2. CƠ CHẾ LINK PHÒNG HỌC LỚP & GIAO BÀI TẬP

### 2.1. Link Phòng Học Cố Định (Classroom-Level Meeting Link):
- Link phòng học được lưu tại `class_rooms.meeting_link`.
- Học viên chỉ cần bấm nút **"Vào Lớp"** ở trang lớp học hoặc ở chi tiết buổi học là mở thẳng link Google Meet / Zoom / Teams của lớp.
- Gia sư có nút **"Chỉnh sửa Link phòng học"** trên giao diện lớp học để cập nhật tức thì nếu gặp trục trặc kỹ thuật.

### 2.2. Giao Bài Tập & Tài Liệu Trước Nhiều Ngày (Session-Level):
- Mỗi buổi học trong `class_sessions` hỗ trợ:
  - `topic`: Chủ đề bài giảng của buổi học (Ví dụ: *"Buổi 1: Giới thiệu cấu trúc dữ liệu"*).
  - `assignment_title`, `assignment_description`: Yêu cầu bài tập về nhà.
  - `assignment_file_url`: File đề bài / slide bài giảng đính kèm.
- Gia sư có thể soạn thảo bài tập cho cả 3 buổi trong tuần từ nhiều ngày trước.

---

## 3. CƠ CHẾ TỰ ĐỘNG KHÓA LỚP THEO NGÀY KHAI GIẢNG (CLASSROOM AUTO-LOCK)

### 3.1. Điều kiện Kích hoạt Khóa lớp:
1. **Đạt đủ sĩ số tối đa (`occupiedCount >= maxStudents`):** Lớp tự động chuyển sang `LOCKED`.
2. **Đến ngày khai giảng (`LocalDate.now() >= startDate`):**
   - Tiến trình ngầm `ClassroomLifecycleScheduler` quét định kỳ hàng ngày.
   - Nếu lớp đang ở trạng thái `PUBLISHED` mà `startDate <= today`:
     - Chuyển trạng thái lớp thành `LOCKED`.
     - Hủy các yêu cầu xin học còn `PENDING` chưa được duyệt.
     - Tự động gọi `RollingSessionService` để **kích hoạt mở 1 tuần học đầu tiên**.

---

## 4. CƠ CHẾ ĐIỂM DANH ĐỘC LẬP & MỞ KHÓA BÀI TẬP THÔNG MINH

### 4.1. Khung Giờ Điểm Danh:
$$\text{Thời gian Check-in hợp lệ} = [\text{start\_time}, \quad \text{end\_time}] \quad \text{trong đúng ngày } \text{session\_date}$$

* **Học viên:** Bấm nút **"Điểm danh vào học"** (1 chạm) trong khung giờ học.
* **Gia sư:** Bấm nút **"Điểm danh vào dạy"** (1 chạm) trong khung giờ học + có thể mở **"Xem Danh Sách Lớp"** để theo dõi sĩ số realtime (và điểm danh hộ nếu học viên gặp sự cố).

### 4.2. Khóa / Mở Khóa Đề Bài (Gated Assignment Access):
- **Học viên chưa điểm danh:** Khối bài tập hiển thị `🔒 KHÓA ĐỀ BÀI` và ẩn link tải file tài liệu.
- **Học viên đã điểm danh:** Khối bài tập lập tức hiển thị `🔓 ĐÃ MỞ KHÓA BÀI TẬP`, học viên có thể xem hướng dẫn và tải file về làm.
- **Buổi học không có bài tập:** Học viên chỉ cần điểm danh bình thường.

---

## 5. CƠ CHẾ TỰ ĐỘNG HOÀN TẤT BUỔI HỌC KHI HẾT GIỜ

- **Tiến trình ngầm (`ClassroomLifecycleScheduler`):** Quét định kỳ mỗi phút (`@Scheduled(fixedDelay = 60000)`).
- Khi thời gian thực tế chạm hoặc vượt qua giờ kết thúc (`now >= endTime` hoặc sang ngày hôm sau):
  1. Tự động chuyển trạng thái buổi học sang **`COMPLETED`**.
  2. Tự động phân xử kết quả:
     - Gia sư có mặt + Học viên có mặt $\rightarrow$ `BOTH_PRESENT` (Gia sư 85%, Sàn 15%).
     - Gia sư có mặt + Học viên không điểm danh $\rightarrow$ `STUDENT_ABSENT_TUTOR_PRESENT` (Gia sư 45%, Sàn 10%, Hoàn học viên 45%).
     - Gia sư không điểm danh vào dạy $\rightarrow$ `TUTOR_ABSENT` (Hoàn 100% cho học viên).
  3. Tự động sinh cuốn chiếu đợt học của tuần tiếp theo.

---

## 6. QUY TRÌNH KHIẾU NẠI 24H & PHÂN QUYỀN TRỌNG TÀI CHUẨN MASTER GUIDE

1. **Mở Cửa Sổ Khiếu Nại 24h:** Khi buổi học chuyển sang `COMPLETED`, hệ thống đề xuất quyết toán `proposeSessionSettlement` on-chain và kích hoạt đồng hồ đếm ngược 24h.
2. **Khóa Tiền On-Chain:** Học viên khiếu nại $\rightarrow$ Gọi tx `openTutorFraudDispute` on-chain để đóng băng tiền của đúng agreement đó (học viên 0 gas).
3. **Đối Chất & Giải Trình:** Gia sư nhận thông báo và nộp lời giải trình + ảnh/video minh chứng.
4. **Phân Quyền Trọng Tài:**
   - **`STAFF`:** Chỉ phân xử các lớp do chính Staff đó kiểm duyệt (`ClassRoom.reviewedByEmail`).
   - **`ADMIN`:** Toàn quyền phân xử mọi khiếu nại trên toàn hệ thống.
   - Gửi tx `resolveTutorFraudDispute` on-chain (APPROVED hoàn 100%, REJECTED chia 85/15).

---

## 7. KIẾN TRÚC DỮ LIỆU & RÀNG BUỘC QUAN HỆ (DATABASE ARCHITECTURE)

### 7.1. Bảng `class_sessions`:
* `id` (BIGINT PK)
* `classroom_id` (BIGINT FK -> class_rooms.id)
* `sequence_number` (INT)
* `topic` (VARCHAR 255)
* `session_date` (DATE)
* `start_time` (VARCHAR 10)
* `end_time` (VARCHAR 10)
* `assignment_title`, `assignment_description`, `assignment_file_url`
* `status` (VARCHAR 30: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED)

### 7.2. Bảng `session_attendances`:
* `id` (BIGINT PK)
* `session_id` (BIGINT FK -> class_sessions.id)
* `student_id` (BIGINT)
* `student_name`, `student_email`
* `tutor_id` (BIGINT)
* `tutor_checked` (BOOLEAN), `tutor_checked_at` (TIMESTAMP)
* `student_checked` (BOOLEAN), `student_checked_at` (TIMESTAMP)
* `final_outcome` (VARCHAR 40: BOTH_PRESENT, STUDENT_ABSENT_TUTOR_PRESENT, TUTOR_ABSENT)

---

## 8. CƠ CHẾ SMART CONTRACT ESCROW & QUY TẮC GIẢI NGÂN

```text
                                [ BUỔI HỌC HOÀN TẤT ]
                                          │
                                          ▼
                      proposeSessionSettlement(outcome, 24h)
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
          [ HỌC VIÊN ĐỒNG Ý ]                             [ HỌC VIÊN KHIẾU NẠI ]
          (Hết 24h tự động)                               (openTutorFraudDispute)
                  │                                               │
                  ▼                                               ▼
        finalizeSessionSettlement                     Gia sư nộp bản giải trình & ảnh
                  │                                               │
        ┌─────────┴─────────┐                                     ▼
        ▼                   ▼                             Trọng tài Staff / Admin
[BOTH_PRESENT]     [STUDENT_ABSENT]                     resolveTutorFraudDispute(...)
  85% Gia sư          45% Gia sư                                  │
  15% Platform        10% Platform                        ┌───────┴───────┐
                      45% Hoàn HV                         ▼               ▼
                                                     [APPROVED]      [REJECTED]
                                                      Hoàn 100%       Chia 85/15
```
