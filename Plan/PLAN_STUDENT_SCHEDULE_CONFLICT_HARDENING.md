# Kế hoạch siết chặt chống trùng lịch học viên

> Ngày lập: 2026-11-07
> Phạm vi: `learning-service`, Web Student/Tutor và dữ liệu vận hành liên quan
> Trạng thái: **ĐÃ TRIỂN KHAI VÀ KIỂM CHỨNG LOCAL / CHƯA DEPLOY VPS; browser canary và audit dữ liệu production còn cần thực hiện**

## 1. Sự cố và kết luận audit

Ảnh vận hành cho thấy cùng một học viên đang có:

- Lớp Toán `#46`: Thứ Bảy, `13:00 - 14:30`.
- Lớp Hóa `#47`: Thứ Bảy, `13:00 - 14:30`.

Đây là trùng lịch hoàn toàn và không được phép tồn tại đồng thời ở trạng thái giữ chỗ hoặc đang học.

Source hiện tại **đã có** kiểm tra trùng lịch, nhưng mới đủ cho một nhánh đơn giản:

1. `EnrollmentRequestService.enrollClass(...)` gọi `validateNoScheduleConflict(...)` khi học viên gửi yêu cầu.
2. Hàm này chỉ coi enrollment `ACCEPTED` và `ENROLLED` là lịch đang chiếm chỗ.
3. Hai yêu cầu cùng giờ đều có thể được tạo khi cả hai còn `PENDING`.
4. `acceptRequest(...)` chỉ kiểm tra quyền Tutor, trạng thái lớp và sức chứa; **không kiểm tra lại lịch học viên**.
5. `activateEnrollment(...)` chuyển `ACCEPTED -> ENROLLED` sau khi hợp đồng/ký quỹ được kích hoạt; **không kiểm tra lại lịch học viên**.
6. Lock hiện tại là lock theo từng classroom. Hai Tutor duyệt hai classroom khác nhau cùng lúc không bị tuần tự hóa theo học viên.
7. Web chỉ so lớp đang xem với `GET /api/student/schedule`, trong khi API lịch tuần cố ý chỉ trả enrollment `ENROLLED`; vì vậy Web cũng không nhìn thấy lịch đang giữ chỗ `ACCEPTED` hoặc yêu cầu `PENDING`.

Kết luận gốc lỗi: kiểm tra đúng công thức giao thời gian đã có, nhưng đặt sai biên nghiệp vụ và thiếu chống race condition. Đây không phải lỗi riêng của trang lịch.

## 2. Quy tắc nghiệp vụ đề xuất

### 2.1. Trạng thái chiếm lịch

| Enrollment | Có chiếm lịch? | Xử lý |
| --- | --- | --- |
| `PENDING` | Có, theo chính sách nghiêm ngặt | Học viên không được gửi thêm yêu cầu khác trùng giờ; có thể tự hủy yêu cầu để giải phóng. |
| `ACCEPTED` | Có | Giữ chỗ trong thời gian hoàn tất hợp đồng/ký quỹ. |
| `ENROLLED` | Có | Lịch học chính thức. |
| `REJECTED`, `EXPIRED`, `CANCELLED` | Không | Không chặn yêu cầu mới. |

Classroom `CANCELLED` hoặc `CLOSED` không chiếm lịch. Classroom/enrollment đang trong HOLD hoặc chờ quyết toán/hoàn cọc vẫn chiếm lịch vì quyết định có thể bị bác bỏ hoặc chưa hoàn tất; giữ nguyên baseline tại `docs/BUSINESS_RULES.md`.

### 2.2. Công thức trùng

Hai lịch trùng khi đồng thời thỏa:

1. Khoảng ngày của hai lớp giao nhau (tính cả ngày đầu và ngày cuối).
2. Cùng `dayOfWeek` theo chuẩn dữ liệu `2..8`.
3. `startA < endB && startB < endA`.

Hai ca sát nhau như `13:00-14:30` và `14:30-16:00` được phép. Không tự thêm buffer di chuyển trong lần sửa này; nếu cần buffer cho lớp offline phải được xác nhận thành quy tắc nghiệp vụ riêng.

### 2.3. Điểm bắt buộc kiểm tra

Backend phải gọi cùng một policy dùng chung tại:

1. Gửi yêu cầu tham gia lớp.
2. Tutor duyệt yêu cầu.
3. Kích hoạt enrollment sau khi escrow được xác nhận.
4. Mọi API sửa lịch lớp/buổi học được bổ sung trong tương lai.

Frontend chỉ cảnh báo sớm; phản hồi backend mới là quyết định cuối cùng.

## 3. Thiết kế tinh chỉnh

### 3.1. Gom policy chống trùng

Tách logic khỏi `EnrollmentRequestService` thành một component/service duy nhất, ví dụ `StudentScheduleConflictPolicy`:

- Nhận `studentId`, classroom mục tiêu và enrollment cần loại trừ.
- Truy vấn các enrollment chiếm lịch cùng classroom/schedules trong một lần.
- Loại trừ chính enrollment/classroom mục tiêu.
- Áp dụng thống nhất status enrollment và status classroom.
- Trả về conflict có cấu trúc: class ID/tên lớp, thứ, giờ, khoảng ngày và trạng thái giữ chỗ.
- Dữ liệu lịch sai định dạng phải fail closed và ghi log cảnh báo; không được âm thầm `continue` để bỏ qua ràng buộc.

Ưu tiên `studentId` làm định danh chuẩn. Email chỉ dùng tương thích dữ liệu cũ nếu phát hiện enrollment legacy thiếu `studentId`.

### 3.2. Chống duyệt đồng thời

Classroom lock không bảo vệ được hai thao tác trên hai lớp khác nhau. Bổ sung transaction-level guard theo `studentId` trên PostgreSQL trước khi đọc lịch đang chiếm chỗ.

Phương án đề xuất: PostgreSQL transaction advisory lock với khóa ổn định từ `studentId`, giữ đến cuối transaction. Thứ tự lock thống nhất ở mọi luồng:

1. Lock classroom mục tiêu.
2. Lock schedule guard của học viên.
3. Đọc lại request/enrollment và lịch chiếm chỗ.
4. Kiểm tra conflict.
5. Chuyển trạng thái và commit.

Nhờ vậy, nếu hai Tutor duyệt đồng thời, giao dịch thắng trước giữ lịch; giao dịch sau đọc trạng thái mới và nhận `409 Conflict`. Cần test integration bằng PostgreSQL thật, không chỉ Mockito.

Nếu advisory lock bị đánh giá khó quan sát/vận hành, phương án thay thế là migration V20 tạo bảng `student_schedule_guards(student_id PK)` và dùng `SELECT ... FOR UPDATE`. Không triển khai đồng thời cả hai cơ chế.

### 3.3. Phản hồi API và UX

Chuẩn hóa lỗi thành HTTP `409` với mã máy đọc được, ví dụ:

```json
{
  "code": "STUDENT_SCHEDULE_CONFLICT",
  "message": "Lịch Thứ Bảy 13:00 - 14:30 trùng với lớp Toán lớp 11.",
  "conflictingClassId": 46,
  "conflictingClassName": "Toán lớp 11 (002-2026)",
  "dayOfWeek": 7,
  "startTime": "13:00",
  "endTime": "14:30"
}
```

Web Student:

- Trang chi tiết lớp tải thêm danh sách reservation `PENDING/ACCEPTED/ENROLLED`, hoặc dùng endpoint preflight riêng.
- Vô hiệu hóa nút gửi yêu cầu và hiển thị rõ lớp/khung giờ đang trùng.
- Sau lỗi `409`, refresh lại request và schedule để tránh UI cũ.

Web Tutor:

- Khi duyệt thất bại, giữ nguyên request và báo rằng học viên đã có lịch khác; không hiển thị thành lỗi chung.
- Có hành động từ chối với lý do gợi ý, nhưng không tự động từ chối nếu chưa xác nhận quy tắc thông báo/audit.

### 3.4. Không mở rộng sai phạm vi

- Không thay đổi kiến trúc JWT/cookie, role hoặc domain ownership.
- Không tạo service mới; Learning Service tiếp tục sở hữu classroom/enrollment/schedule.
- Không sửa trực tiếp hợp đồng hoặc blockchain để “né” conflict.
- Không dùng frontend làm hàng rào duy nhất.
- Chưa thêm buffer giữa hai ca và chưa xử lý khoảng cách địa lý lớp offline trong lần này.

## 4. Xử lý dữ liệu VPS hiện tại

Không cập nhật trực tiếp trạng thái trong PostgreSQL. Với lớp Hóa đang trùng:

1. Thực hiện đúng luồng hủy/chấm dứt lớp trên Web.
2. Theo dõi Contract Service đến khi quyết toán/hoàn USDC được xác nhận theo event on-chain.
3. Xác nhận enrollment hoặc classroom Hóa đã thật sự `CANCELLED`/`CLOSED` trong Learning Service.
4. Xác nhận lịch Hóa không còn ở lịch tuần/upcoming, nhưng lịch sử buổi đã phát sinh vẫn còn để audit.
5. Xác nhận lớp Toán vẫn `ENROLLED`, các session và attendance không bị ảnh hưởng.
6. Chỉ sau trạng thái cuối mới xem khung giờ Hóa là đã giải phóng.

Trước khi bật bản sửa trên production, chạy audit read-only để liệt kê mọi cặp enrollment `PENDING/ACCEPTED/ENROLLED` trùng lịch theo học viên. Không tự động hủy hàng loạt; mỗi trường hợp có hợp đồng/escrow phải được đối soát và xử lý qua lifecycle tương ứng.

## 5. Kế hoạch kiểm thử

### 5.1. Unit test policy

- Trùng hoàn toàn, trùng một phần, bao chứa.
- Hai ca sát biên không trùng.
- Cùng giờ khác thứ không trùng.
- Cùng lịch tuần nhưng khoảng ngày không giao nhau không trùng.
- Thiếu ngày kết thúc được xử lý an toàn.
- `PENDING`, `ACCEPTED`, `ENROLLED` đều chặn.
- `REJECTED`, `EXPIRED`, `CANCELLED` không chặn.
- Class `CANCELLED/CLOSED` giải phóng lịch.
- HOLD/chờ refund vẫn giữ lịch.
- Loại trừ chính request/class mục tiêu.

### 5.2. Service/API test

- `enrollClass` trả `409` khi có reservation trùng.
- `acceptRequest` kiểm tra lại và không publish `ENROLLMENT_ACCEPTED` khi conflict.
- `activateEnrollment` kiểm tra lại trước khi tạo attendance.
- Lỗi rollback không để lại agreement/status/event nửa chừng.
- Thông báo tiếng Việt chứa đủ lớp, thứ và giờ bị trùng.

### 5.3. Concurrency integration test

Trên PostgreSQL thật, chạy hai transaction đồng thời duyệt hai request cùng học viên, hai classroom khác nhau nhưng cùng giờ:

- Đúng một request được `ACCEPTED`.
- Request còn lại nhận `409` và không phát event accepted.
- Không deadlock, không duplicate attendance, không tạo hai agreement hợp lệ.

Lặp lại kịch bản tại activation để bảo vệ event escrow đến gần đồng thời.

Ngày 2026-11-07 đã rehearsal chính câu lệnh `pg_advisory_xact_lock` trên PostgreSQL 16 thật bằng hai transaction đồng thời cùng Student: transaction thứ hai chờ 2,89 giây đến khi transaction đầu commit. Bằng chứng này xác nhận primitive khóa và namespace hoạt động đúng; browser/cross-service canary sau deploy vẫn là gate riêng để xác nhận toàn luồng request → Tutor accept → escrow activation.

### 5.4. Browser/runtime regression

- Student thấy cảnh báo trước khi gửi.
- Tutor nhận thông báo đúng khi duyệt conflict.
- Hủy request `PENDING` giải phóng lịch ngay.
- Chấm dứt có escrow chỉ giải phóng sau trạng thái cuối.
- Lịch tuần, lớp của tôi, hợp đồng, thông báo và attendance nhất quán sau refresh/re-login.

## 6. Thứ tự triển khai

1. Chốt policy status ở Mục 2 với người dùng.
2. Viết test tái hiện lỗi hiện tại trước.
3. Tách policy và chuẩn hóa lỗi `409`.
4. Bổ sung student transaction guard và gọi policy tại ba cửa.
5. Cập nhật Web Student/Tutor.
6. Chạy Learning targeted suite, full Learning suite, frontend tests/typecheck/build.
7. Rehearsal concurrency trên PostgreSQL 16. **Đã đạt với advisory-lock transaction thật.**
8. Audit read-only dữ liệu production và xử lý thủ công các conflict hiện hữu.
9. Deploy canary; tái hiện hai yêu cầu cùng giờ và xác nhận chỉ một yêu cầu có thể giữ lịch.
10. Sau khi có bằng chứng runtime, cập nhật `docs/BUSINESS_RULES.md`, `docs/API.md` và `docs/IMPLEMENTATION_STATUS.md`.

## 7. Điều kiện hoàn tất

- Không thể tạo hai reservation trùng lịch cho cùng học viên theo policy đã chốt.
- Hai Tutor duyệt đồng thời vẫn chỉ có một transaction thành công.
- Activation sau escrow không thể biến dữ liệu cũ/race thành hai lớp `ENROLLED` trùng giờ.
- Hủy/chấm dứt giải phóng lịch đúng lifecycle và không làm mất lịch sử audit.
- API trả lỗi có cấu trúc; Student và Tutor đều hiểu lý do trên UI.
- Có unit, service và PostgreSQL concurrency evidence trước PR; browser/runtime canary phải đạt trước khi tuyên bố `IMPLEMENTED + DEPLOYED`.
