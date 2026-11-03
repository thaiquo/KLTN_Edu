# Kế hoạch đóng lớp rỗng và bảo toàn hủy lớp khi Student trial cuối cùng rời lớp

> Trạng thái: **IN PROGRESS — PRE-MERGE VERIFIED**
> Ngày rà soát: **2026-11-03**
> Nhánh làm việc khi triển khai: `feature/quocthai`
> Phạm vi: `learning-service`, hồi quy liên dịch vụ với `contract-service`, `frontend-web`, notification/realtime và tài liệu vận hành.
> Không thuộc phạm vi: bật Tutor Absence `ENFORCE`, thay đổi Smart Contract/Solidity, thay đổi tỷ lệ settlement hoặc giải phóng lịch trước khi blockchain xác nhận hoàn cọc.

## 0. Mục tiêu và kết luận audit

Mục tiêu cuối cùng gồm hai quy tắc độc lập nhưng phải có kết quả lịch giống nhau khi lớp không còn người học:

1. **Student cuối cùng dừng học thử đúng hạn**:
   - Ngừng các buổi sau cutoff ngay khi opt-out được tiếp nhận.
   - Chỉ sau khi settlement bắt buộc và refund on-chain được xác nhận mới đóng enrollment.
   - Nếu không còn Student/agreement hiệu lực thì lớp chuyển `CANCELLED`, không sinh buổi mới và lịch của cả Student lẫn Tutor được tái sử dụng.
2. **Lớp đến ngày khai giảng nhưng không có Student hiệu lực**:
   - Không có escrow cần thanh lý, vì vậy lớp chuyển thẳng `CLOSED` trong lần quét lifecycle.
   - Không tạo buổi học tuần đầu, đóng các request còn chờ và giải phóng lịch Tutor ngay sau khi transaction đóng lớp thành công.

Kết quả audit source:

- Quy tắc 1 đã được triển khai qua commit `b31bade` và harden tại `0a86e3b`. `TerminationProcessor` chỉ gửi `cancelClassIfEmpty=true` khi không còn agreement khác chưa kết thúc; `LearningTerminationService` khóa bi quan lớp, đóng enrollment, đếm `ACCEPTED/ENROLLED`, hủy lớp rỗng và lưu kết quả replay vào command inbox.
- Quy tắc 2 đã được triển khai cục bộ trên `feature/quocthai` nhưng **chưa merge/deploy**. Scheduler khóa lớp, chỉ đánh giá lớp `PUBLISHED`, đếm `ACCEPTED/ENROLLED`, rồi chuyển `CLOSED` hoặc `LOCKED` theo đúng nhánh.
- Luồng duyệt enrollment đã được harden: lấy ID lớp, khóa bi quan lớp, re-check trạng thái `PUBLISHED`, sau đó mới đọc lại và duyệt request. Điều này loại race với scheduler.
- Lớp `ACTIVE` cũ không tự đóng từ enrollment cục bộ; lớp đang có cutoff termination bị bỏ qua.
- Cleanup lớp rỗng chỉ hủy buổi `SCHEDULED` từ ngày xử lý trở đi và bảo toàn lịch sử `IN_PROGRESS`/`COMPLETED`/buổi quá khứ.
- Yêu cầu `PENDING` bị lifecycle hủy phát notification bền vững `ENROLLMENT_SYSTEM_CANCELLED` cho Student; Gia sư nhận realtime `CLASS_AUTO_CLOSED` và màn lịch tự refresh.
- `LOCKED` đang chặn lịch Tutor ở backend và frontend. Không được loại `LOCKED` khỏi danh sách trạng thái chiếm lịch, vì trạng thái này còn đại diện cho lớp đủ sĩ số, lớp đã bắt đầu có người học và lớp đang thanh lý.
- Automated gate đã pass: Learning 331/331, Notification 80/80, Contract 321 run = 313 pass + 8 Anvil skipped, Frontend Node 24/24, TypeScript và production build. PR/CI, browser walkthrough và production canary chưa thực hiện.

### 0.1. Tiến độ triển khai hiện tại

| Nhóm | Trạng thái |
| --- | --- |
| TASK-00..03 — lifecycle, khóa race, cleanup an toàn | Hoàn tất cục bộ; targeted test pass |
| TASK-04 — dry-run/reconciliation production | Chưa chạy; script SQL riêng của người dùng không bị sửa |
| TASK-05 — policy chiếm lịch backend/frontend | Hoàn tất cục bộ; frontend dùng utility chung |
| TASK-06 — hồi quy trial last-student | Hoàn tất; Learning và Contract full suite pass |
| TASK-07 — notification/realtime | Hoàn tất cục bộ; targeted test pass |
| TASK-08 — docs canonical | Hoàn tất cục bộ và đã đối chiếu với source/test |
| TASK-09 — full validation | Automated gate hoàn tất; browser walkthrough còn chờ |
| TASK-10 — commit/PR/deploy/canary | Commit/push nhánh feature hoàn tất; còn PR/deploy/canary |

## 1. Quy tắc nghiệp vụ phải chốt trước khi sửa

### 1.1. Phân biệt `LOCKED`, `CLOSED` và `CANCELLED`

| Tình huống | Trạng thái | Có giữ lịch Tutor? | Có sinh buổi mới? | Có thanh lý escrow? |
| --- | --- | --- | --- | --- |
| Chờ duyệt/mở bán/chưa đến ngày học | `PENDING_APPROVAL`, `PRIVATE`, `PUBLISHED` | Có | Chưa | Không |
| Đủ sĩ số hoặc đến ngày học và có Student hiệu lực | `LOCKED` | Có | Có theo rolling lifecycle | Có theo từng agreement |
| Đang thanh lý toàn lớp | `LOCKED` + `terminationCutoffSession` | Có đến khi hoàn tất | Không sau cutoff | Có |
| Đến ngày học nhưng 0 Student hiệu lực | `CLOSED` | Không | Không | Không |
| Đã có hợp đồng và lớp bị hủy sau settlement/refund | `CANCELLED` | Không | Không | Đã hoàn tất/được đối soát |

Không dùng `LOCKED` cho lớp rỗng cần giải phóng lịch. Không dùng `CANCELLED` cho lớp chưa có hợp đồng cần thanh lý; `CLOSED` đã tồn tại đúng cho trường hợp đó.

### 1.2. Định nghĩa Student hiệu lực khi quét ngày khai giảng

Để tương thích với activation/funding bất đồng bộ, một lớp được xem là còn Student hiệu lực nếu Learning có ít nhất một enrollment ở một trong hai trạng thái:

- `ACCEPTED`: đã được Tutor chấp nhận, quy trình hợp đồng/funding có thể đang tiếp diễn.
- `ENROLLED`: funding đã xác nhận và Student đã được kích hoạt.

`PENDING`, `REJECTED`, `EXPIRED`, `CANCELLED` không giữ lớp mở sau `startDate`.

Quy tắc này cố ý không chỉ đếm `ENROLLED`: đóng lớp khi còn `ACCEPTED` có thể đua với agreement đang đăng ký/funding và tạo late-activation không an toàn.

### 1.3. Thời điểm hiệu lực

- Với lớp 0 Student: đóng trong lần quét lifecycle đầu tiên thỏa `startDate <= businessToday`, múi giờ `Asia/Ho_Chi_Minh`.
- Với trial opt-out: HOLD/cutoff có hiệu lực ngay để chặn buổi tương lai; `CANCELLED` và giải phóng lịch chỉ sau khi refund event được Contract xác nhận và Learning nhận `CLOSE`.
- “Không còn buổi học tiếp theo” nghĩa là:
  - Không tạo session mới.
  - Session tương lai đã tồn tại được giữ làm audit nhưng chuyển `CANCELLED`.
  - Attendance tương lai của session bị hủy được xóa.

### 1.4. Quy tắc chiếm lịch

- Chiếm lịch Tutor: `PENDING_APPROVAL`, `PRIVATE`, `PUBLISHED`, `ACTIVE`, `LOCKED`.
- Không chiếm lịch Tutor: `REJECTED`, `CLOSED`, `CANCELLED`.
- Student chỉ bị chặn trùng lịch bởi enrollment `ACCEPTED/ENROLLED` thuộc lớp chưa `CLOSED/CANCELLED`.
- Danh sách lịch rảnh do Tutor khai báo không bị tự xóa; giao diện tính lịch trống bằng lịch rảnh trừ lớp còn hiệu lực.

## 2. State transition mục tiêu

### 2.1. Lớp đến ngày khai giảng

```text
PUBLISHED + startDate <= today
  -> khóa bi quan class_rooms
  -> đếm ACCEPTED + ENROLLED
     -> count == 0
        -> CLOSED
        -> đóng PENDING requests
        -> hủy session/attendance tương lai nếu dữ liệu cũ đã sinh nhầm
        -> KHÔNG gọi RollingSessionService
        -> phát realtime/notification cho Tutor
     -> count > 0
        -> LOCKED
        -> đóng tuyển sinh còn lại
        -> sinh batch đầu theo RollingSessionService
```

### 2.2. Student trial cuối cùng opt-out

```text
DECISION_OPEN + serverReceivedAt < trialDeadline
  -> HOLD cutoff = session 1
  -> settlement session 1
  -> cancelAgreementAndRefundUnused
  -> UNUSED_AMOUNT_REFUNDED confirmed
  -> Contract kiểm tra không còn agreement chưa kết thúc
  -> Learning CLOSE với cancelClassIfEmpty=true
  -> khóa bi quan class_rooms
  -> enrollment mục tiêu = CANCELLED
  -> đếm ACCEPTED + ENROLLED
     -> còn Student: lớp tiếp tục, chỉ giải phóng lịch Student opt-out
     -> 0 Student: lớp = CANCELLED, hủy session tương lai/PENDING requests,
                   giải phóng lịch Student và Tutor
```

## 3. Thiết kế kỹ thuật

### 3.1. Giữ đúng domain ownership

- Learning Service tiếp tục sở hữu `class_rooms`, enrollment, class session, attendance và quyết định cuối cùng lớp `CLOSED/CANCELLED`.
- Contract Service tiếp tục sở hữu agreement, settlement, refund và chỉ yêu cầu Learning đóng trial sau khi có bằng chứng tài chính hợp lệ.
- Không tạo service mới, không chuyển domain ownership và không sửa Solidity.

### 3.2. Transaction theo từng lớp

Không tiếp tục xử lý `classRoomRepository.findAll()` trong một transaction lớn.

Thiết kế đề xuất:

- `ClassroomLifecycleScheduler`: chỉ xác định thời điểm chạy và lặp candidate ID; không chứa nghiệp vụ chuyển trạng thái.
- Tạo `ClassroomLifecycleService.processStartingClassroom(Long classroomId, LocalDate businessToday)` với `@Transactional`.
- Service tải lớp bằng `findByIdForUpdate()` (`PESSIMISTIC_WRITE`) trước khi đếm enrollment và đổi trạng thái.
- Mỗi lớp là một transaction riêng; lỗi một lớp không rollback tất cả lớp khác.
- Cùng khóa `class_rooms` với `activateEnrollment()`, Rolling Session và trial auto-cancel để tuần tự hóa các đường ghi cạnh tranh.

### 3.3. Candidate query có giới hạn

Thay `findAll().stream()` bằng repository query lấy đúng ID cần xử lý:

1. `PUBLISHED` có `startDate <= today` để phân nhánh `CLOSED/LOCKED`.
2. `ACTIVE` có `startDate <= today` chỉ để giữ hành vi sinh buổi lũy tiến idempotent; tuyệt đối không tự đóng từ enrollment của Learning Service.

Không tự sửa `LOCKED` hoặc `ACTIVE` thành `CLOSED` bằng scheduler. Với dữ liệu production cũ, phải có dry-run report và đối chiếu Contract trước mọi reconciliation ghi trạng thái.

### 3.4. Cleanup lớp rỗng phải lũy đẳng

Trong nhánh `activeStudentCount == 0`:

- Nếu đã `CLOSED`, trả về thành công và không phát sự kiện trùng.
- Chuyển lớp sang `CLOSED`.
- Với request `PENDING`: chuyển trạng thái kết thúc và lưu lý do “Lớp tự đóng do không có học viên khi đến ngày khai giảng”. Ưu tiên `CANCELLED` để thống nhất với lớp bị hệ thống đóng; không giả thành quyết định từ chối của Tutor.
- Chỉ với session `SCHEDULED` có `sessionDate >= businessToday`: chuyển `CANCELLED` và xóa attendance của chính session đó.
- Giữ nguyên session quá khứ, `IN_PROGRESS`, `COMPLETED` và attendance tương ứng để audit.
- Không đặt termination cutoff giả và không tạo termination case vì không có escrow cần thanh lý.
- Không gọi `generateInitialWeekSessions()`.
- Phát đúng một class lifecycle event/realtime update và notification cho Tutor.

### 3.5. Không phá vỡ `LOCKED`

Giữ `LOCKED` là trạng thái chiếm lịch. Chỉ giải phóng lịch bằng việc chuyển đúng lớp rỗng sang `CLOSED` hoặc lớp đã thanh lý sang `CANCELLED`.

Backend dùng `ClassRoomScheduleOccupancyPolicy`; frontend dùng `classScheduleOccupancy.js` tại cả Create Class Wizard và Tutor Availability để tránh hai màn hình hiểu trạng thái khác nhau.

## 4. Danh sách task triển khai

### TASK-00 — Khóa baseline và tạo test đỏ

**Phụ thuộc:** Không.
**Mục tiêu:** Chứng minh lỗi hiện tại trước khi sửa.

File dự kiến:

- Thêm `backend/learning-service/src/test/java/iuh/fit/learning_service/scheduler/ClassroomLifecycleSchedulerTest.java` hoặc test cho service lifecycle mới.
- Dùng lại fixture từ `LearningTerminationServiceTest`, `RollingSessionServiceTest`, `EnrollmentRequestScheduleConflictTest` khi phù hợp.

Test bắt buộc ban đầu:

- `publishedClassWithZeroEffectiveStudentsClosesWithoutGeneratingSessions` phải fail với code hiện tại.
- `publishedClassWithEffectiveStudentLocksAndGeneratesInitialSessions` mô tả nhánh không được phá.
- `terminatingLockedClassIsNeverAutoClosed` bảo vệ lớp đang thanh lý.

**Tiêu chí hoàn tất:** Có ít nhất một test đỏ tái hiện chính xác `LOCKED + generate sessions` cho lớp 0 Student.

### TASK-01 — Repository query và transaction boundary

**Phụ thuộc:** TASK-00.

File dự kiến:

- `ClassRoomRepository.java`
- `ClassroomLifecycleScheduler.java`
- Thêm `ClassroomLifecycleService.java`

Công việc:

1. Thêm query candidate có status/date rõ ràng, không dùng `findAll()`.
2. Scheduler lấy business date một lần rồi gọi service theo từng ID.
3. Service khóa bi quan từng lớp và re-check status/date sau khi có lock.
4. Catch/log lỗi theo từng ID; lớp sau vẫn được xử lý.

**Tiêu chí hoàn tất:** Không còn transaction lớn quét toàn bảng; test chứng minh lỗi một candidate không chặn candidate tiếp theo.

### TASK-02 — Đóng lớp 0 Student thành `CLOSED`

**Phụ thuộc:** TASK-01.

File dự kiến:

- `ClassroomLifecycleService.java`
- `EnrollmentRequestRepository.java` nếu cần query/update theo status.
- `ClassSessionRepository.java`
- `SessionAttendanceRepository.java`
- `LearningEventPublisher.java` hoặc publisher lifecycle/realtime hiện hữu.

Công việc:

1. Đếm `ACCEPTED + ENROLLED` trong transaction đã khóa lớp.
2. Nếu bằng 0, chuyển `CLOSED`.
3. Đóng request `PENDING` và phát event phù hợp, không để Student tiếp tục ký/fund từ request đã hết hiệu lực.
4. Chỉ hủy session `SCHEDULED` từ ngày xử lý trở đi và attendance liên quan; không sửa lịch sử quá khứ/đang học/đã hoàn tất.
5. Không gọi Rolling Session.
6. Gửi notification/realtime trung tính, không nhắc hoàn cọc.

**Tiêu chí hoàn tất:** Lớp rỗng không có session mới, không còn request mở, không còn trạng thái chiếm lịch và không có transaction blockchain.

### TASK-03 — Bảo toàn nhánh lớp có Student

**Phụ thuộc:** TASK-01.

Công việc:

1. Nếu có `ACCEPTED/ENROLLED`, lớp `PUBLISHED` chuyển `LOCKED`.
2. Đóng/cancel request `PENDING` còn dư theo quy tắc tuyển sinh.
3. Gọi `generateInitialWeekSessions()` đúng một lần về mặt hiệu quả; Rolling Service tiếp tục idempotent.
4. Không giải phóng lịch Tutor.

**Tiêu chí hoàn tất:** Lớp có người học vẫn vận hành như trước; không bị chuyển nhầm `CLOSED`.

### TASK-04 — Reconciliation dữ liệu `LOCKED` cũ

**Phụ thuộc:** TASK-02, TASK-03.

Công việc:

1. Tạo truy vấn/report read-only liệt kê lớp `LOCKED/ACTIVE` quá `startDate`, cutoff null, 0 `ACCEPTED/ENROLLED`.
2. Đối chiếu agreement không kết thúc trước khi sửa production; không dùng Learning để tự suy đoán trạng thái tài chính bất nhất.
3. Chỉ cho lifecycle service chuyển các record đã qua điều kiện an toàn sang `CLOSED`.
4. Ghi số lượng candidate, ID, trạng thái trước/sau và timestamp vào changelog vận hành; không ghi PII.

**Tiêu chí hoàn tất:** Không có câu lệnh update hàng loạt mù; có dry-run và danh sách target chính xác trước mutation.

### TASK-05 — Chuẩn hóa chính sách chiếm lịch

**Phụ thuộc:** TASK-02.

File dự kiến:

- Thêm `ClassRoomScheduleOccupancyPolicy.java`.
- `ClassRoomService.java`
- `TutorAvailabilityController.java`
- `CommunityPostService.java`
- Thêm/cập nhật utility frontend dùng bởi `TutorAvailabilityScheduler.tsx`.

Công việc:

1. Gom danh sách blocking statuses backend về một nguồn.
2. Frontend dùng danh sách tương ứng và có unit test.
3. Xác nhận `CLOSED/CANCELLED` không chặn tạo lớp hoặc sửa lịch rảnh.
4. Xác nhận `LOCKED` vẫn chặn, kể cả lớp đủ sĩ số và lớp đang termination.

**Tiêu chí hoàn tất:** Backend và frontend cho cùng kết quả đối với mọi status; không sửa bằng cách bỏ `LOCKED` toàn cục.

### TASK-06 — Hồi quy trial last-student end-to-end ở mức source

**Phụ thuộc:** Có thể chạy song song TASK-01..05 nhưng phải hoàn tất trước merge.

File dự kiến:

- `LearningTerminationServiceTest.java`
- `TerminationProcessorTest.java`
- `TerminationFlowIntegrationTest.java`
- `RollingSessionServiceTest.java`
- `EnrollmentRequestScheduleConflictTest.java`
- `TutorAvailabilityControllerTest.java` và test tạo lớp trùng lịch.

Ma trận test:

1. Trial Student cuối cùng: lớp `CANCELLED`, future sessions `CANCELLED`, attendance/PENDING request được dọn.
2. Trial còn Student/agreement khác: lớp không hủy; chỉ lịch Student opt-out được giải phóng.
3. Retry/replay cùng command trả đúng `classCancelled` đã persist.
4. Activation và auto-cancel cùng khóa lớp; không kích hoạt Student vào lớp đã đóng.
5. `CANCELLED` chặn Rolling Session sinh batch mới.
6. Sau `COMPLETED`, Student đăng lớp trùng giờ được; Tutor tạo lớp trùng giờ được nếu lớp đã `CANCELLED`.
7. Trước refund/`COMPLETED`, lịch vẫn bị giữ.

**Tiêu chí hoàn tất:** Không thay đổi thứ tự settlement/refund/CLOSE và không giải phóng lịch sớm.

### TASK-07 — Giao diện và thông báo vòng đời lớp

**Phụ thuộc:** TASK-02, TASK-05.

File dự kiến:

- `TutorClassManagement.tsx`
- `TutorAvailabilityScheduler.tsx`
- Admin class management nếu cần label/tooltip.
- Notification event template/consumer liên quan.

Công việc:

1. `CLOSED`: “Lớp tự đóng vì đến ngày khai giảng nhưng không có học viên hiệu lực.”
2. `CANCELLED`: “Lớp đã hủy và hoàn tất thanh lý.”
3. `LOCKED`: phân biệt khóa tuyển sinh, đang học và đang thanh lý nếu có termination context.
4. Không hiển thị thông điệp “đã hoàn tiền” cho `CLOSED`.
5. Sau realtime refresh, lịch Tutor không còn render lớp `CLOSED/CANCELLED` là occupied.
6. Student có request bị lifecycle hủy nhận notification bền vững `ENROLLMENT_SYSTEM_CANCELLED` và trang lớp tự refresh.

**Tiêu chí hoàn tất:** UI không mâu thuẫn với backend và không gây hiểu nhầm tài chính.

### TASK-08 — Tài liệu canonical

**Phụ thuộc:** Sau khi source/test chốt; không đánh dấu IMPLEMENTED sớm.

File dự kiến:

- `docs/BUSINESS_RULES.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/session/EDUCONNECT_SESSION_ATTENDANCE_ESCROW_MASTER_PLAN.md`
- `docs/TRIAL_TERMINATION_MANUAL_CHECKLIST.md`
- `docs/changelog.md`

Công việc:

1. Ghi state table `LOCKED/CLOSED/CANCELLED` chính thức.
2. Sửa tài liệu session cũ đang nói mọi lớp đến ngày bắt đầu đều `LOCKED` và sinh batch đầu.
3. Bổ sung checklist lớp 0 Student và kiểm tra tái sử dụng lịch Tutor.
4. Giữ trạng thái `IN PROGRESS — PRE-MERGE HARDENING` cho đến khi full-suite gate, PR/CI và production canary hoàn tất.

### TASK-09 — Validation gate trước PR

**Phụ thuộc:** TASK-00..08.

Backend bắt buộc:

- Learning targeted tests cho lifecycle/termination/rolling/schedule conflict.
- Toàn bộ Learning suite.
- Contract targeted termination/trial tests.
- Toàn bộ Contract suite; Anvil skipped phải được ghi rõ, không biến thành PASS giả.
- PostgreSQL migration validation nếu cuối cùng có migration; thiết kế v1 dự kiến không cần migration vì tái sử dụng `CLOSED`.

Frontend bắt buộc:

- Unit test policy trạng thái chiếm lịch.
- TypeScript/typecheck.
- Production build.
- Browser walkthrough Tutor class management và Tutor availability.

Quality gate:

- `git diff --check`.
- Không đưa `.env`, private key, wallet secret hoặc PII vào commit.
- Không sửa/xóa `scripts/verify_governance_scenarios.sql` đang là file riêng chưa track của người dùng.

### TASK-10 — PR, deploy và production canary

**Phụ thuộc:** TASK-09.

1. Commit trên `feature/quocthai`, push không force.
2. Mở PR vào `main`; chờ CI gate và review.
3. Sau merge, xác nhận release tag và health trước khi canary.
4. Canary lớp rỗng:
   - Tạo lớp thử có `startDate` ngày kế tiếp, không gửi enrollment.
   - Sau lần quét 00:01 hoặc startup scan: lớp phải `CLOSED`.
   - `class_sessions` không có row mới; không có attendance mới.
   - Tutor tạo được lớp mới trùng lịch cũ và chỉnh được lịch rảnh.
5. Canary trial last Student:
   - Dùng lớp mới có ít nhất hai buổi và một Student test.
   - Hoàn thành session 1, opt-out đúng hạn.
   - Theo dõi đến refund event và termination `COMPLETED`.
   - Lớp `CANCELLED`, session sau cutoff `CANCELLED` và lịch hai phía được tái sử dụng.
6. Giữ `TUTOR_ABSENCE_GOVERNANCE_MODE=SHADOW`; thay đổi này không cấp quyền bật `ENFORCE`.

## 5. Ma trận nghiệm thu cuối

| ID | Kịch bản | Kết quả bắt buộc |
| --- | --- | --- |
| AC-01 | PUBLISHED tới startDate, 0 active Student | `CLOSED`, không sinh session, lịch Tutor rảnh |
| AC-02 | PUBLISHED tới startDate, có ACCEPTED | `LOCKED`, giữ lịch, sinh session theo policy |
| AC-03 | PUBLISHED tới startDate, có ENROLLED | `LOCKED`, giữ lịch, sinh session/attendance |
| AC-04 | LOCKED đang termination, cutoff khác null | Không auto-close, vẫn giữ lịch |
| AC-05 | LOCKED cũ, cutoff null, 0 active Student | Chỉ đóng sau reconciliation an toàn |
| AC-06 | Trial opt-out còn Student khác | Enrollment mục tiêu đóng; lớp và lịch Tutor tiếp tục |
| AC-07 | Trial opt-out Student cuối cùng | Sau refund: lớp `CANCELLED`, không sinh session, lịch hai phía rảnh |
| AC-08 | Trial đang chờ settlement/refund | Session sau cutoff ngừng nhưng lịch chưa được tái sử dụng |
| AC-09 | Replay command | Không lặp notification/mutation; snapshot giữ nguyên |
| AC-10 | CLOSED/CANCELLED chạy lại scheduler | Không thay đổi, không sinh session |

## 6. Rủi ro và chốt an toàn

| Rủi ro | Chốt kiểm soát |
| --- | --- |
| Đóng lớp trong lúc agreement đang funding | Đếm cả `ACCEPTED`; khóa bi quan lớp; activation re-check trạng thái |
| Giải phóng nhầm mọi lớp `LOCKED` | Không bỏ `LOCKED` khỏi blocking statuses; chỉ chuyển đúng record sang `CLOSED/CANCELLED` |
| Scheduler lỗi một lớp làm rollback cả batch | Transaction riêng theo classroom ID |
| Tạo session sau khi lớp đóng | Re-check dưới lock; `CLOSED/CANCELLED` và cutoff đều chặn Rolling Service |
| Hủy lịch sử học | Chỉ cancel session chưa hoàn tất; giữ completed history |
| Thông báo hoàn tiền sai | `CLOSED` không dùng wording tài chính; trial chỉ báo hoàn sau event chain |
| Sửa nhầm dữ liệu production cũ | Dry-run, đối chiếu agreement, target ID cụ thể, backup trước mutation |
| Frontend/backend lệch trạng thái chiếm lịch | Policy tập trung + unit test hai phía |

## 7. Thứ tự thực hiện khuyến nghị

```text
TASK-00 test đỏ
  -> TASK-01 transaction/query
  -> TASK-02 đóng lớp rỗng
  -> TASK-03 giữ nhánh có Student
  -> TASK-04 reconciliation dữ liệu cũ
  -> TASK-05 policy lịch
  -> TASK-06 trial regression
  -> TASK-07 UI/notification
  -> TASK-08 docs
  -> TASK-09 validation
  -> TASK-10 PR/deploy/canary
```

Không gộp bước sửa dữ liệu production vào cùng commit code một cách tự động. Code phải deploy và qua test/canary trước; reconciliation dữ liệu cũ là thao tác vận hành riêng với target đã đối soát.
