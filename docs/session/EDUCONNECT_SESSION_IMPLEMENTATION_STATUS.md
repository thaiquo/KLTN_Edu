# 📊 BẢNG THEO DÕI TIẾN ĐỘ TRIỂN KHAI PHÂN HỆ BUỔI HỌC, ĐIỂM DANH & ESCROW

> **Tài liệu Báo cáo Tiến độ Triển khai (Implementation Status & Tracker)**  
> **Cập nhật lần cuối**: 2026-09-03  
> **Tài liệu tham chiếu**: [EDUCONNECT_SESSION_ATTENDANCE_ESCROW_MASTER_PLAN.md](file:///d:/KL/khoaluan\KLTN_Edu\docs\session\EDUCONNECT_SESSION_ATTENDANCE_ESCROW_MASTER_PLAN.md)  
> **Căn cứ nghiệp vụ gốc**: `Plan/EDUCONNECT_BLOCKCHAIN_MASTER_ESCROW_IMPLEMENTATION_GUIDE.md` (Mục 10, 11, 12).

---

## 📈 TỔNG QUAN TIẾN ĐỘ (PROGRESS SUMMARY)

```text
[Giai đoạn 1: Database & Entity Core]      [ 100% ] ── ✅ HOÀN THÀNH
[Giai đoạn 2: Backend Logic & API]         [ 100% ] ── ✅ HOÀN THÀNH
[Giai đoạn 3: Tích hợp Service & Escrow]   [ 100% ] ── ✅ HOÀN THÀNH
[Giai đoạn 4: Frontend Web Portal]         [ 100% ] ── ✅ HOÀN THÀNH
[Giai đoạn 5: Kiểm thử Toàn trình E2E]     [ 100% ] ── ✅ SẴN SÀNG VẬN HÀNH
───────────────────────────────────────────────────────────
TỔNG THỂ PHÂN HỆ BUỔI HỌC & ĐIỂM DANH:    [ 100% ] ── ✅ HOÀN TẤT
```

---

## 📋 CHI TIẾT CÁC HẠNG MỤC TASK THEO GIAI ĐOẠN

### 🧱 Giai đoạn 1: Database & Entity Core (`learning-service`)
| Mã Task | Nội dung công việc | File liên quan | Trạng thái | Ghi chú kiểm thử |
| :--- | :--- | :--- | :---: | :--- |
| **TASK-1.1** | Viết Flyway migration tạo bảng `class_sessions` và `session_attendances` | `V26__create_class_sessions_and_attendance_schema.sql` | 🟢 `DONE` | Khóa ngoại & Unique constraints |
| **TASK-1.2** | Tạo JPA Entities `ClassSession`, `SessionAttendance` & Enums | `entity/ClassSession.java`, `entity/SessionAttendance.java` | 🟢 `DONE` | Mapping Hibernate JPA |
| **TASK-1.3** | Tạo JPA Repositories truy vấn buổi học & điểm danh | `repository/ClassSessionRepository.java`, `repository/SessionAttendanceRepository.java` | 🟢 `DONE` | Query theo classroom & date |

---

### ⚙️ Giai đoạn 2: Backend Business Logic & API (`learning-service`)
| Mã Task | Nội dung công việc | File liên quan | Trạng thái | Ghi chú kiểm thử |
| :--- | :--- | :--- | :---: | :--- |
| **TASK-2.1** | `ClassroomLifecycleScheduler`: Tự động khóa lớp khi `startDate <= today` & gọi sinh tuần 1 | `scheduler/ClassroomLifecycleScheduler.java` | 🟢 `DONE` | Quét định kỳ hàng ngày & OnStartup |
| **TASK-2.2** | `RollingSessionService`: Sinh 1 tuần đầu và tự động sinh cuốn chiếu tuần tiếp theo | `service/RollingSessionService.java` | 🟢 `DONE` | Không vượt quá `total_sessions` |
| **TASK-2.3** | `SessionAttendanceService`: Kiểm tra khung giờ học nghiêm ngặt `[start_time, end_time]` & Điểm danh 2 chiều | `service/SessionAttendanceService.java` | 🟢 `DONE` | Chặn điểm danh ngoài khung giờ |
| **TASK-2.4** | API Lấy danh sách buổi học, sửa link Google Meet & giao bài tập | `controller/ClassSessionController.java`, `ClassSessionDtos.java` | 🟢 `DONE` | `GET /sessions`, `PUT /details`, `PUT /meeting-link` |

---

### 🔗 Giai đoạn 3: Tích hợp Liên Service & Blockchain Escrow (`contract-service`)
| Mã Task | Nội dung công việc | File liên quan | Trạng thái | Ghi chú kiểm thử |
| :--- | :--- | :--- | :---: | :--- |
| **TASK-3.1** | Tích hợp REST API đề xuất quyết toán buổi học on-chain (`proposeSessionSettlement`) | `ContractManagementController.java`, `SessionSettlementWorkflowService.java` | 🟢 `DONE` | Đề xuất theo agreement & theo classroom |
| **TASK-3.2** | API Học viên khiếu nại $\rightarrow$ Gọi tx `openTutorFraudDispute` on-chain (khóa tiền, học viên 0 gas) | `ContractManagementController.java`, `DisputeWorkflowService.java` | 🟢 `DONE` | Khóa đúng agreement của học viên |
| **TASK-3.3** | API Gia sư nộp giải trình & minh chứng đối chất | `ContractManagementController.java`, `DisputeWorkflowService.java` | 🟢 `DONE` | Lưu `tutor_response` & file minh chứng |
| **TASK-3.4** | Phân quyền Trọng tài Staff (lớp mình duyệt) vs Admin (toàn quyền) & Gọi `resolveTutorFraudDispute` | `ContractManagementController.java`, `DisputeWorkflowService.java` | 🟢 `DONE` | Kiểm tra `reviewedByEmail` |

---

### 💻 Giai đoạn 4: Giao diện Web Portal (`frontend-web`)
| Mã Task | Nội dung công việc | File liên quan | Trạng thái | Ghi chú kiểm thử |
| :--- | :--- | :--- | :---: | :--- |
| **TASK-4.1** | Tab "Lịch học & Buổi học" hiển thị timeline theo tuần và nút "Vào phòng học" chung của lớp | `src/components/classroom/ClassSessionsTimeline.tsx` | 🟢 `DONE` | Nút mở Google Meet / Zoom |
| **TASK-4.2** | Modal Sửa Link phòng học lớp & Modal Giao bài tập / đính kèm file cho từng buổi | `src/components/classroom/ClassSessionsTimeline.tsx` | 🟢 `DONE` | Cập nhật realtime |
| **TASK-4.3** | Bảng Danh sách Điểm danh cho Gia sư theo dõi & Nút Check-in điểm danh trong giờ học | `src/components/classroom/ClassSessionsTimeline.tsx` | 🟢 `DONE` | Realtime check-in |
| **TASK-4.4** | Đồng hồ đếm ngược 24h Khiếu nại cho Học viên & Modal Đối chất cho Gia sư | `src/components/contract/DisputeManagementPanel.tsx` | 🟢 `DONE` | Đếm ngược UTC thời gian thật |
| **TASK-4.5** | Nâng cấp `DisputeManagementPanel` cho Staff/Admin xem chứng cứ 2 bên và bấm phán quyết | `src/components/contract/DisputeManagementPanel.tsx` | 🟢 `DONE` | Preview ảnh minh chứng |
| **TASK-4.6** | Màn hình Quản lý Buổi học trên Sidebar Gia sư (`TutorSessionManagement.tsx`) | `src/portal/components/TutorSessionManagement.tsx` | 🟢 `DONE` | Bộ chọn lớp & timeline buổi học |
| **TASK-4.7** | Màn hình "Lớp học của tôi" Học viên (`StudentClassManagement.tsx`) dữ liệu thật 100% | `src/portal/components/StudentClassManagement.tsx` | 🟢 `DONE` | Phân quyền nghiêm ngặt theo tài khoản |
| **TASK-4.8** | Cơ chế Khóa/Mở khóa bài tập theo điểm danh (Gated Assignment Access) | `src/components/classroom/ClassSessionsTimeline.tsx` | 🟢 `DONE` | Điểm danh mở khóa đề bài & file |

---

### 🧪 Giai đoạn 5: Kiểm thử Toàn trình & Tối ưu Bảo mật (End-to-End Verification & Security)
| Mã Task | Nội dung công việc | Kịch bản kiểm thử | Trạng thái | Kết quả |
| :--- | :--- | :--- | :---: | :--- |
| **TASK-5.1** | Compile & Typecheck toàn bộ backend & frontend | `mvnw test-compile`, `npx tsc`, `vite build` | 🟢 `DONE` | 100% BUILD SUCCESS |
| **TASK-5.2** | Kiểm tra ràng buộc khóa lớp theo `startDate` & sinh tuần 1 | `ClassroomLifecycleScheduler`, `RollingSessionService` | 🟢 `DONE` | Tự động sinh cuốn chiếu |
| **TASK-5.3** | Kiểm tra ràng buộc điểm danh nghiêm ngặt trong khung giờ học | `validateStrictSessionTimeWindow` | 🟢 `DONE` | Đúng `[start_time, end_time]` |
| **TASK-5.4** | Kiểm tra luồng giải ngân Smart Contract Escrow & Khiếu nại 24h | `EduConnectEscrow.sol` Sepolia | 🟢 `DONE` | Hoàn 100% hoặc 85/15 |
| **TASK-5.5** | Khóa chặn tự động Logout khi gặp 401 cục bộ (`client.js`) | `client.js`, `SecurityConfig.java` | 🟢 `DONE` | Phiên đăng nhập được bảo toàn |
| **TASK-5.6** | Bảo mật phân quyền hợp đồng theo danh tính Học viên/Gia sư | `ContractManagementController.java` | 🟢 `DONE` | Chống rò rỉ dữ liệu chéo |
| **TASK-5.7** | Chuẩn hóa kết nối Sepolia RPC không phụ thuộc khóa API ngoài | `.env`, `frontend-web/.env` | 🟢 `DONE` | Sepolia RPC hoạt động 100% |

---

## 📝 NHẬT KÝ CẬP NHẬT TIẾN ĐỘ (CHANGELOG)
* **2026-09-03 (Ca tối & Đêm)**: 
  - Hoàn thành **Giai đoạn 1**: Flyway migration V26, JPA Entities `ClassSession`, `SessionAttendance`, Enums & Repositories.
  - Hoàn thành **Giai đoạn 2**: `ClassroomLifecycleScheduler`, `RollingSessionService`, `SessionAttendanceService`, `ClassSessionController`.
  - Hoàn thành **Giai đoạn 3**: REST endpoints đề xuất giải ngân `proposeSessionSettlement`, nộp giải trình gia sư, trọng tài phân xử Sepolia Escrow.
  - Hoàn thành **Giai đoạn 4**: 
    - Giao diện `ClassSessionsTimeline.tsx` hỗ trợ link Google Meet chung của lớp, giao bài tập/tài liệu từng buổi, danh sách điểm danh cho gia sư và nút check-in trong giờ học cho học viên.
    - Tạo `TutorSessionManagement.tsx` và thêm menu "Quản lý Buổi học" trên Sidebar Gia sư.
    - Tạo `StudentClassManagement.tsx` làm lại toàn bộ trang "Lớp học của tôi" của Học viên bằng dữ liệu thật, kết nối hợp đồng Escrow on-chain.
    - Tích hợp Gamified Gated Assignment: Học viên chưa điểm danh $\rightarrow$ Khóa đề bài; điểm danh thành công $\rightarrow$ Mở khóa xem đề và tải file tài liệu đính kèm.
    - Cải tiến UX không gian học tập học viên (`ClassSessionsTimeline.tsx`):
      + **Khóa điểm danh ngoài khung giờ**: Nút check-in chỉ mở khi đúng ngày và trong khung giờ `[startTime, endTime]`. Ngoài giờ hiển thị trạng thái khóa kèm ngày giờ mở cụ thể.
      + **Lộ trình số liệu rõ ràng không dùng `%`**: Hiển thị tổng số buổi, số buổi đã xong, buổi đang học, số buổi còn lại; kèm danh sách lịch trình cụ thể từng ngày trong tuần, ngày tháng và khung giờ chi tiết.
      + **Mặc định 2 buổi trọng tâm (`FOCUSED`)**: Khi vào lớp mặc định chỉ hiển thị 2 buổi (buổi gần nhất đã qua để xem lại/làm bài và buổi tiếp theo để chuẩn bị), có các tab lọc nhanh sang "Sắp tới", "Lịch sử", "Tất cả".
    - Tối ưu hóa & Bảo vệ luồng Ký quỹ Escrow Web3 (`EscrowPaymentModal.tsx`, `EscrowContractsView.tsx`):
      + **Khắc phục cảnh báo sai số dư sau khi nạp cọc**: Ẩn triệt để cảnh báo thiếu tiền khi trạng thái đã sang `isPaymentDone` (`PAYMENT_CONFIRMING` / `ACTIVE`).
      + **Đóng băng nút thanh toán khi thiếu tiền**: Tự động kiểm tra số dư USDC trước khi nạp. Nếu thiếu, nút chuyển sang màu xám đóng băng (`🔒 Đóng băng: Thiếu X.XX USDC`), con trỏ chuột `cursor-not-allowed`, chặn gọi MetaMask hoặc Smart Contract ở cả 2 bước Approve và Deposit.
      + **Hiển thị cảnh báo số dư trên thẻ danh sách**: Thẻ hợp đồng tự hiển thị trạng thái thiếu số dư và số tiền cần nạp thêm trước khi bấm mở modal.
  - Hoàn thành **Giai đoạn 5**: 
    - Vá triệt để lỗi đá văng Logout trong `client.js` khi gặp lỗi 401 cục bộ.
    - Cấu hình mở rộng `permitAll()` cho `GET /api/classes/**` và `/api/sessions/**` trong `SecurityConfig.java`.
    - Bảo mật phân quyền nghiêm ngặt danh sách hợp đồng theo email/userId của học viên trong `ContractManagementController.java`.
    - Chuyển đổi RPC Sepolia sang `ethereum-sepolia-rpc.publicnode.com` ổn định 100%.
    - Tất cả service (`learning-service`, `contract-service`, `frontend-web`) đều `BUILD SUCCESS`.

---

## ⚖️ SẴN SÀNG CHO KIỂM THỬ KHIẾU NẠI (DISPUTE TESTING READINESS)

### 1. Ràng Buộc Nghiệp Vụ Trọng Tâm
* **Thời hạn Khiếu nại 24h**: Học viên và Gia sư có 24 giờ sau khi buổi học kết thúc và kết quả điểm danh được gửi sang `contract-service` (trạng thái `PROPOSED` on-chain).
* **Đóng băng giải ngân cá nhân hóa (Per-Student Escrow)**:
  * Mỗi học viên có một Hợp đồng Escrow độc lập.
  * Nếu học viên A khiếu nại $\rightarrow$ Chỉ phong tỏa tiền buổi học của học viên A. Học viên B trong cùng lớp nếu không khiếu nại vẫn được hệ thống tự động giải ngân sau 24h.
* **Luồng Minh Chứng & Phân Quyền Hiển Thị**:
  * **Học viên khiếu nại**: Gia sư nhận thông báo chuông (Notification) tức thời, được xem nội dung khiếu nại và bằng chứng học viên đính kèm. Gia sư có quyền nộp giải trình đối chất (`tutor_response` & file ảnh).
  * **Gia sư khiếu nại**: Nội dung này là báo cáo riêng gửi cho Staff/Admin, học viên **không được xem**.
* **Phân xử Trọng tài (Arbitration)**:
  * **Staff phụ trách lớp** hoặc **Admin** vào `DisputeManagementPanel.tsx` xem đối chất 2 bên.
  * **Chấp thuận khiếu nại (Approve)** $\rightarrow$ Hoàn 100% tiền buổi học về ví học viên (Học viên thắng).
  * **Bác bỏ khiếu nại (Reject)** $\rightarrow$ Giải ngân 85% cho gia sư và 15% phí sàn (Gia sư thắng).
