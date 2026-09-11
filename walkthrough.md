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
