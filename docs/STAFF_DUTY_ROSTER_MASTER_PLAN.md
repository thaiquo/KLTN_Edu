# KẾ HOẠCH CHỐT — ĐIỀU PHỐI LỊCH TRỰC STAFF VÀ QUYỀN GHI THEO CA

> **Mã phân hệ:** `STAFF_DUTY_ROSTER_V1`
> **Kiến trúc:** EduConnect Service-Based Architecture
> **Owner dữ liệu:** `backend/account-service`
> **Các nơi thực thi quyền:** `account-service`, `learning-service`, `contract-service`, `frontend-web`
> **Nhánh:** `feature/quocthai`
> **Production:** Đã xác minh ngày 2026-11-08 trên release `3de6020`: Account/Learning/Contract cùng nhận `STAFF_DUTY_ENFORCEMENT_ENABLED=true`; tuần 2026-11-09 đến 2026-11-14 có đủ 12/12 ca đã phân công và công bố. `false` chỉ còn là kill switch khẩn cấp.

## 1. Quyết định nghiệp vụ đã chốt

### 1.1. Luồng vận hành

1. Staff đăng ký các ca rảnh cho tuần kế tiếp. Đây là dữ liệu nguyện vọng để hỗ trợ xếp lịch, không phải quyền tự chọn ca.
2. Admin có thể tạo ngay một lịch trống và tự phân công toàn bộ, kể cả khi chưa Staff nào đăng ký lịch rảnh.
3. Thuật toán có thể gợi ý lịch dựa trên lịch rảnh, tránh trùng ca cùng ngày và cân bằng số ca. Kết quả chỉ là bản nháp, không tự công bố và không thay thế quyết định của Admin.
4. Admin xem đề xuất, sửa bất kỳ ca nào và là người duy nhất công bố lịch chính thức.
5. Admin chỉ được công bố khi đủ 12 ca và mỗi ca đã có một Staff active.
6. Đến ca, Staff bấm **Bắt đầu ca trực** để nhận ca.
7. Chỉ Staff đã nhận đúng ca và ca vẫn đang diễn ra mới được thực hiện thao tác ghi thuộc quyền Staff.
8. Ngoài ca, chưa nhận ca hoặc ca đã kết thúc, Staff chỉ được xem dữ liệu thuộc phạm vi hiện có.
9. Nếu Staff vắng/nghỉ đột xuất, Admin tự trao đổi với các Staff, chọn người đã đồng ý nhận thay, cập nhật trên hệ thống và nhập lý do bắt buộc. Staff mới phải bấm **Bắt đầu ca trực**.
10. Mọi thao tác tạo lịch, đề xuất, phân công, công bố, sửa, thay người, nhận ca và tự đóng ca đều được lưu audit.

### 1.2. Vai trò của thuật toán gợi ý xếp lịch

- V1 dùng thuật toán xác định theo quy tắc/ràng buộc; đây không phải AI, Machine Learning hoặc LLM.
- Phân hệ không gọi `ai-service`, Gemini hay dịch vụ AI bên ngoài.
- Input gồm lịch rảnh Staff đã đăng ký, Staff active, ca đã phân và ràng buộc không xếp hai ca cùng ngày.
- Output chỉ là bản nháp đề xuất. Admin có thể chấp nhận, sửa hoặc bỏ toàn bộ đề xuất.
- Admin được gán Staff ngoài lịch rảnh khi đã trao đổi thực tế; UI phải cảnh báo đây là override và audit vẫn ghi người thực hiện.
- Hệ thống tuyệt đối không tự công bố lịch và không tự thay người khi có ca vắng.

### 1.3. Giới hạn quyền bắt buộc

`ON_DUTY` không có nghĩa là Staff trở thành Admin.

- Role, `activeRole` và ownership/reviewer hiện tại vẫn là lớp phân quyền thứ nhất.
- Lịch trực là lớp điều kiện thứ hai dành riêng cho thao tác ghi của Staff.
- Staff đang trực chỉ được làm các nghiệp vụ vốn đã cấp cho role `STAFF`.
- Staff vẫn bị giới hạn bởi `classroomReviewerEmail`, assignee và các ownership rule hiện có.
- Các nghiệp vụ Admin-only như quản lý người dùng, danh mục/môn học, tài chính và quyết định toàn cục vẫn chỉ thuộc Admin.
- Admin không bị giới hạn theo ca trực.
- Các thao tác đọc (`GET`, `HEAD`) không bị khóa theo ca.
- Backend là nguồn thực thi quyền. Frontend chỉ phản ánh trạng thái và vô hiệu hóa nút để cải thiện UX.
- Source và Compose dùng `STAFF_DUTY_ENFORCEMENT_ENABLED=true` mặc định. Cờ phải cùng giá trị ở Account/Learning/Contract; chỉ đặt `false` để rollback khẩn cấp. Không deploy cấu hình bật gate khi chưa có lịch đã công bố cho tuần hiệu lực đầu tiên.

### 1.4. Công thức quyền ghi

```text
STAFF_WRITE_ALLOWED =
    authenticated
    AND activeRole == STAFF
    AND existing_business_authorization == true
    AND assignment.staff_id == currentUser.id
    AND assignment.status == CHECKED_IN
    AND shiftStart <= now(Asia/Bangkok) < shiftEnd
```

Nếu không thỏa, API ghi trả `403 STAFF_OFF_DUTY_READ_ONLY`. Admin không áp dụng công thức này.

### 1.5. Ca trực V1

- Thứ Hai đến Thứ Bảy.
- `MORNING`: 08:00–12:00.
- `EVENING`: 18:00–22:00.
- 12 ca/tuần.
- Quy mô demo hiện tại: 3 Staff, mục tiêu cân bằng khoảng 4 ca/người/tuần.
- Thuật toán phải hoạt động với số Staff active động, không hard-code đúng ba tài khoản.
- Ngoài các khung trên, Admin xử lý tình huống khẩn cấp.

## 2. Kiến trúc và mô hình dữ liệu

### 2.1. Ownership

- Account Service sở hữu availability, assignment, audit và trạng thái ca trực.
- Learning/Contract không sao chép bảng lịch trực.
- Các service cần kiểm tra quyền ghi Staff gọi internal duty-check của Account bằng service JWT.
- Kiểm tra liên service fail-closed: không xác minh được trạng thái đang trực thì không cho Staff ghi.
- Không ghi trạng thái `ON_DUTY` vào JWT người dùng vì trạng thái sẽ lỗi thời khi hết ca hoặc khi Admin thay người.

### 2.2. Flyway V5

File: `backend/account-service/src/main/resources/db/migration/V5__staff_duty_roster.sql`

#### `staff_availability`

- `id BIGSERIAL PRIMARY KEY`
- `staff_id BIGINT NOT NULL REFERENCES users(id)`
- `work_date DATE NOT NULL`
- `shift_code VARCHAR(20) NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- unique `(staff_id, work_date, shift_code)`

#### `staff_shift_assignments`

- `id BIGSERIAL PRIMARY KEY`
- `work_date DATE NOT NULL`
- `shift_code VARCHAR(20) NOT NULL`
- `staff_id BIGINT NULL REFERENCES users(id)`
- `status VARCHAR(20) NOT NULL`
- `published_at TIMESTAMPTZ NULL`
- `check_in_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`
- `version BIGINT NOT NULL DEFAULT 0`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- unique `(work_date, shift_code)`

#### `staff_shift_audits`

- `id BIGSERIAL PRIMARY KEY`
- `assignment_id BIGINT NOT NULL REFERENCES staff_shift_assignments(id)`
- `action VARCHAR(30) NOT NULL`
- `previous_staff_id BIGINT NULL REFERENCES users(id)`
- `new_staff_id BIGINT NULL REFERENCES users(id)`
- `changed_by BIGINT NULL REFERENCES users(id)`; scheduler được phép để null
- `reason TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

Không cascade-delete audit. Assignment V1 không có API xóa cứng.

### 2.3. Trạng thái

```text
DRAFT --Admin publish--> ASSIGNED --Staff start--> CHECKED_IN
CHECKED_IN --shift expired--> COMPLETED
ASSIGNED --shift expired without start--> ABSENT
```

- `DRAFT` có thể chưa có người hoặc đã được phân người.
- `ASSIGNED` bắt buộc có `staff_id` và `published_at`.
- `CHECKED_IN` bắt buộc có `check_in_at`.
- Không dùng trạng thái `PUBLISHED`; công bố được biểu diễn bằng `published_at`.
- Tuần được xem là đã công bố khi đủ 12 assignment và tất cả có `published_at`.

### 2.4. Audit action

- `CREATED`
- `AUTO_ASSIGNED`
- `MANUAL_ASSIGNED`
- `PUBLISHED`
- `REASSIGNED`
- `CHECKED_IN`
- `COMPLETED`
- `ABSENT`

## 3. Quy tắc nghiệp vụ chi tiết

### 3.1. Đăng ký rảnh

- `weekStartDate` phải là thứ Hai của tuần kế tiếp.
- Slot chỉ thuộc thứ Hai–thứ Bảy của đúng tuần đó.
- Không nhận ngày quá khứ, Chủ nhật hoặc slot trùng.
- Staff chỉ sửa availability của chính mình.
- Cửa sổ đăng ký/chỉnh sửa cho tuần kế tiếp kết thúc lúc 23:59 Thứ Bảy theo múi giờ `Asia/Bangkok`. Từ Chủ nhật, Staff chỉ xem dữ liệu đã gửi; Admin dùng dữ liệu hiện có hoặc tự phân công cho tuần bắt đầu ngày kế tiếp.
- Availability đã gửi trước hạn không bị xóa khi cửa sổ đóng và vẫn là dữ liệu nguyện vọng để Admin/thuật toán tham khảo.
- Sau khi tuần đã công bố, availability của tuần đó bị khóa.

### 3.2. Thuật toán gợi ý xếp lịch (`auto-assign`)

Với từng slot theo thứ tự ngày, rồi `MORNING`, `EVENING`:

1. Lấy Staff có role `STAFF` và account `ACTIVE`.
2. Lọc người đã đăng ký rảnh cho slot.
3. Loại người đã có ca khác cùng ngày.
4. Chọn người có ít ca nhất trong tuần; hòa thì chọn `staffId` nhỏ hơn.
5. Không có ứng viên thì giữ slot `DRAFT` với `staff_id = null`.

Auto-assign phải idempotent và chỉ cập nhật slot `DRAFT`; không sửa assignment đã công bố.
Tên hiển thị sản phẩm là **Gợi ý xếp lịch**. Đây là thuật toán nghiệp vụ, không phải chức năng AI và không phải lịch chính thức.

### 3.3. Sửa và công bố

- Admin có thể tạo 12 slot `DRAFT` trống rồi tự phân công, không phụ thuộc availability và không bắt buộc chạy auto-assign.
- Admin được sửa người trực khi assignment còn `DRAFT`.
- Manual assign chỉ chọn Staff active và chưa có ca cùng ngày.
- Admin được override availability trước publish nhưng UI phải cảnh báo và audit `MANUAL_ASSIGNED`.
- Publish chỉ thành công khi có đúng 12 slot, không slot nào trống và tất cả người được gán vẫn active.
- Publish chạy lặp lại phải idempotent và không gửi thông báo trùng.
- Không cho công bố hồi tố khi ca đầu tiên của tuần đã bắt đầu. Khi rollout giữa tuần, tuần hiện tại không được tạo lịch giả cho các ca đã qua; bắt đầu áp dụng từ tuần chưa diễn ra kế tiếp.

### 3.4. Bắt đầu ca

- Cho bấm sớm tối đa 15 phút.
- Cho bấm trễ khi ca chưa kết thúc và hiển thị cảnh báo “Nhận ca trễ”.
- Không được bắt đầu sau giờ kết thúc.
- Gọi lặp lại khi đã `CHECKED_IN` trả về thành công, không tạo audit trùng.
- Dùng giờ server và zone `Asia/Bangkok`.

### 3.5. Thay người khẩn cấp

- Chỉ Admin thực hiện.
- Trước publish: dùng manual assign, không gọi là thay khẩn cấp.
- Sau publish: chỉ thay assignment `ASSIGNED` chưa check-in và chưa hết ca.
- Không thay assignment `CHECKED_IN`, `COMPLETED` hoặc `ABSENT` trong V1.
- Staff mới phải active, khác người cũ và chưa có ca cùng ngày.
- Lý do là bắt buộc.
- Assignment trở lại `ASSIGNED`, giữ `published_at`, chưa có `check_in_at`.
- Người cũ mất quyền ghi của slot ngay sau commit; người mới chỉ có quyền ghi sau khi bấm bắt đầu ca.

### 3.6. Tự đóng ca

Scheduler mỗi 5 phút xử lý mọi assignment quá hạn, kể cả ngày trước nếu service từng downtime:

- `CHECKED_IN -> COMPLETED`
- `ASSIGNED -> ABSENT`

Scheduler idempotent, dùng locking và lưu audit đúng một lần.

## 4. API chốt

### 4.1. Public API qua Gateway

#### Staff

- `GET /api/account/staff/duty/my-roster?weekStartDate=...`
- `POST /api/account/staff/duty/availability`
- `POST /api/account/staff/duty/start-shift`
- `GET /api/account/staff/duty/status`

Gateway rewrite các URL trên thành `/api/staff/duty/**` tại Account Service.

#### Admin

- `GET /api/admin/staff-duty/roster?weekStartDate=...`
- `POST /api/admin/staff-duty/draft?weekStartDate=...`
- `POST /api/admin/staff-duty/auto-assign?weekStartDate=...`
- `PUT /api/admin/staff-duty/assignments/{id}`
- `POST /api/admin/staff-duty/publish?weekStartDate=...`
- `POST /api/admin/staff-duty/assignments/{id}/replace`
- `GET /api/admin/staff-duty/audits?page=...&size=...`
- `GET /api/admin/staff-duty/summary?month=...&year=...`

### 4.2. Internal API

- `GET /api/internal/staff-duty/write-access?staffEmail=...`
- Chỉ chấp nhận service JWT có scope `staff-duty-check` và subject nằm trong allowlist service nội bộ.
- Response tối thiểu: `allowed`, `status`, `assignmentId`, `shiftCode`, `shiftEndAt`.
- Không dùng cookie người dùng để gọi internal API.

### 4.3. Ngoại lệ khỏi duty gate

Staff ngoài ca vẫn được:

- đăng nhập, đăng xuất, refresh và chuyển active role;
- đọc dữ liệu;
- xem/gửi availability;
- xem roster/status;
- bắt đầu đúng ca của mình.

Mọi mutation nghiệp vụ Staff khác trong Account, Learning và Contract phải qua duty gate. Admin, Student và Tutor không bị gate này tác động.

## 5. Frontend V1

### 5.1. Trang Staff — Lịch trực của tôi

- Xem tuần này và tuần tới.
- Đăng ký ca rảnh tuần tới.
- Xem ca đã phân và trạng thái.
- Nút **Bắt đầu ca trực** trong cửa sổ hợp lệ.
- Badge toàn portal: `ĐANG TRỰC`, `SẮP ĐẾN CA`, `NGOÀI CA — CHỈ XEM`.
- Ngoài ca, các nút mutation của Staff bị disable kèm giải thích; backend vẫn là lớp bảo vệ cuối cùng.

### 5.2. Trang Admin — Điều phối lịch trực

- Ma trận 6 ngày × 2 ca.
- **Tạo lịch trống** cho luồng Admin tự phân công hoàn toàn.
- **Gợi ý xếp lịch** đọc availability, tránh trùng ngày và cân bằng ca; Admin được chỉnh tay, nhận cảnh báo override availability rồi publish.
- Không cho publish khi còn ô trống.
- Thay người có lý do bắt buộc.
- Audit timeline.
- Chỉ hiển thị thống kê gọn trên cùng trang; không tạo hệ thống chấm công riêng.

### 5.3. Tích hợp portal bắt buộc

- `frontend-web/src/portal/App.tsx`
- `frontend-web/src/portal/components/Sidebar.tsx`
- `frontend-web/src/portal/portalAccess.js`
- Header/layout Staff để hiển thị badge.
- API client dùng `apiRequest` hiện có, không tạo cơ chế axios/auth thứ hai.

## 6. Notification V1

Chỉ giữ hai Bell notification có giá trị:

- `STAFF_ROSTER_PUBLISHED`
- `STAFF_SHIFT_REASSIGNED`

Mỗi event phải có `eventId`, `recipientUserId` và reference id; Notification consumer idempotent theo event/recipient. Nhắc availability tự động và realtime riêng được hoãn khỏi V1.

## 7. Phân rã task thực thi

Ký hiệu: `[x]` đã hiện thực và có kiểm chứng bước tương ứng; `[~]` đã hiện thực một phần hoặc còn gate nghiệm thu; `[ ]` chưa làm.

### Giai đoạn A — Account core

- [x] A1. Flyway V5 đã rehearsal trên PostgreSQL 16 theo cả hai đường: database fresh chạy V1→V5 và database V1→V4 nâng cấp riêng V5; Hibernate `validate` đều khởi động thành công.
- [x] A2. Enums, entities, repositories và DTO validation.
- [x] A3. Availability, tạo lịch trống, thuật toán gợi ý xếp lịch, manual assign và publish idempotent.
- [x] A4. Start shift, emergency replace, status và audit.
- [x] A5. Catch-up scheduler với injectable `Clock`.
- [x] A6. Internal duty-check bằng service JWT.
- [~] A7. Controller authorization đã gắn; còn bổ sung MockMvc/CSRF coverage chuyên biệt.

### Giai đoạn B — Backend duty enforcement

- [x] B1. Account Staff mutation gate, allowlist duty/auth endpoints.
- [x] B2. Learning Staff mutation gate gọi Account internal API, fail-closed.
- [x] B3. Contract Staff mutation gate gọi Account internal API, fail-closed.
- [x] B4. Admin/role khác không bị gate; reviewer/ownership hiện hữu vẫn chạy phía sau.
- [~] B5. Đã test 403 ngoài ca và active Admin không bị chặn; còn cross-service authenticated E2E reviewer scope.

### Giai đoạn C — Notification

- [x] C1. Event/routing key từ Account sau commit cho công bố lịch và thay người.
- [x] C2. Notification consumer idempotent theo `(eventId, recipientUserId)` cho publish và reassign.
- [x] C3. Bell route target về trang Staff/Admin duty roster.

### Giai đoạn D — Frontend

- [x] D1. `staffDutyApi` dùng `apiRequest`.
- [x] D2. Trang Staff có calendar tuần, điều hướng tuần, trạng thái tiếng Việt, tab đăng ký ca rảnh theo mô hình chọn–chỉnh sửa–hủy–lưu và chỉ hiện nhận ca khi backend trả `canStart`.
- [x] D3. Trang Admin có thẻ tổng quan, calendar tuần, tạo lịch trống, gợi ý xếp lịch, modal manual assign/replace, ưu tiên lịch rảnh, cảnh báo trùng ngày, publish confirmation và audit timeline tiếng Việt.
- [x] D4. Tích hợp `App.tsx`, `Sidebar.tsx`, `portalAccess.js`.
- [~] D5. Trang duty roster có badge/nhận ca; màn duyệt lớp, hồ sơ gia sư và quyền dạy đã đồng bộ banner chỉ xem và khóa nút theo `writeAllowed`. Các màn mutation Staff khác vẫn dựa vào backend 403 và cần tiếp tục đồng bộ UX khi chỉnh sửa từng phân hệ.

### Giai đoạn E — Nghiệm thu

- [x] E1. 12 ca chia cân bằng khi availability cho phép.
- [x] E2. Auto-assign/publish/start-shift/scheduler idempotent, không sinh audit nghiệp vụ trùng khi gọi lại.
- [x] E3. Không publish slot trống; không publish Staff inactive và không gán Staff trùng ngày.
- [~] E4. Publish khóa cả tuần, replace khóa assignment và thao tác gán khóa thêm bản ghi Staff để tuần tự hóa cập nhật, chống lost update/trùng người cùng ngày; còn cần PostgreSQL/browser concurrency E2E cho publish đồng thời replace.
- [x] E5. Scheduler catch-up ca quá hạn từ ngày trước thành `ABSENT` hoặc `COMPLETED` và ghi audit.
- [x] E6. Staff ngoài ca đọc được nhưng mọi mutation nghiệp vụ bị 403 ở ba service.
- [~] E7. Duty gate chỉ là lớp quyền thứ hai và không thay thế reviewer/ownership hiện hữu; còn cần cross-service authenticated E2E chứng minh Staff đang trực vẫn bị giới hạn đúng scope.
- [x] E8. Thay người làm quyền người cũ mất ngay; người mới phải start shift mới có quyền ghi.
- [x] E9. Notification không trùng khi retry nhờ event id ổn định và unique `(event_id, recipient_user_id)`.
- [x] E10. Full regression ngày 2026-11-07: Account 194 PASS; Notification 81 PASS; Learning 342 PASS; Contract 324 run = 316 PASS + 8 Anvil skip; frontend production build PASS. Tổng backend: 941 PASS, 8 skip, 0 failure/error.
- [x] E11. Authenticated local runtime smoke qua Gateway PASS: đọc roster trả đúng 4 Staff active; tạo draft sinh đúng 12 ca và gọi lại không nhân đôi; audit, dispute, termination và operational report đều HTTP 200 trên PostgreSQL thật.

## 8. Thứ tự release

1. Phát triển và kiểm thử local trên `feature/quocthai`.
2. Xác nhận lớp trùng #47 đã đi vào luồng hủy và không sửa trực tiếp dữ liệu lịch sử/audit trong database.
3. Giữ nguyên các flag trial/tutor-absence hiện hành; release roster không được tự chuyển tutor-absence sang `ENFORCE` hoặc thay đổi chính sách trial.
4. Chạy full regression roster + quyền Staff + các luồng Student/Tutor trọng yếu.
5. Mở PR từ `feature/quocthai` vào `main` theo branch protection.
6. Trước deploy, Admin tạo, chỉnh và công bố lịch cho tuần chưa bắt đầu kế tiếp; không backfill tuần đang chạy.
7. Deploy code/schema/UI với `STAFF_DUTY_ENFORCEMENT_ENABLED=true` đồng nhất ở Account/Learning/Contract.
8. Smoke test trạng thái lịch, start shift, thao tác duyệt trong ca và phản hồi chỉ xem ngoài ca.
9. Theo dõi 403/503 và audit trong tuần đầu; nếu có sự cố, đặt cờ `false` ở cả ba service để rollback quyền ghi trong khi giữ nguyên dữ liệu lịch.

## 9. Ngoài phạm vi V1

- Check-out, bảng lương, chấm công theo phút và KPI nhân sự.
- Tự động chuyển reviewer/ownership theo người trực.
- Nhiều người cùng trực một slot.
- Đổi ca trực tiếp giữa hai Staff không qua Admin.
- Mobile parity.
- Nhắc availability nhiều lần, email reminder hoặc realtime presence.
- Seed mật khẩu/tài khoản demo bằng Flyway production.
