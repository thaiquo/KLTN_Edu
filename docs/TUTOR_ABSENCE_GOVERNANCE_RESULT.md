# BÁO CÁO KẾT QUẢ TRIỂN KHAI: QUẢN TRỊ GIA SƯ VẮNG LIÊN TIẾP & THỬ THÁCH (PROBATION)
**Thời điểm ghi nhận**: 2026-10-28 00:30 (Giờ địa phương)
**Nhánh Git**: `feature/tutor-absence-governance`
**Trạng thái**: **IN PROGRESS — code đã deploy, production đang SHADOW; chưa đủ điều kiện chuyển ENFORCE.** Source chính, local regression và PostgreSQL 16 fresh/production-restore rehearsal đã đạt; cross-service/Anvil/observability/browser gates còn mở.

> **Đính chính sau safety audit ngày 2026-10-28:** Bản ghi ban đầu đánh giá quá mức mức độ hoàn thành. Audit lại đã phát hiện và sửa các lỗi quan trọng: SHADOW allowlist có thể bị hiểu thành ENFORCE; case v1 có thể vi phạm constraint deadline khi flush; retry HOLD đi nhầm luồng legacy; `HOLD_SYNC_TIMEOUT` thiếu deadline; snapshot `N+1` từng có fallback giả; inbox replay từng tính lại kết quả; stale RELEASE chưa bắt buộc khớp HOLD; session legacy có thể bị đưa ngược vào governance; UI dùng đồng hồ client và notification nói hoàn tiền quá sớm. Các tuyên bố “hoàn thành toàn bộ/100%/sẵn sàng tích hợp” phía dưới chỉ là lịch sử bàn giao ban đầu và không còn là release verdict.

> **Pre-merge hardening bổ sung:** DB hiện tự bảo đảm mỗi lớp chỉ có một probation `ACTIVE`, kiểm tra lifecycle/resolution của probation, phạm vi whole-class/origin/command của governance case, deadline gắn đúng snapshot `N+1`, và cấu trúc command inbox Learning. Case relapse không còn ghi một “buổi kế tiếp” giả. `SHADOW` không thay đổi probation, Admin không thể cho lớp tiếp tục trước khi Tutor đã giải trình, và hệ thống không gửi thông báo “đã HOLD” khi lệnh HOLD còn lỗi. Contract không còn suy diễn `sessionSequence` từ `sessionId`; Learning từ chối RELEASE thiếu cutoff/effective time/expected HOLD/deadline. Payload Learning→Contract và scoped service JWT đã có contract test ở cả đầu gửi/nhận. Learning V17 có migration test riêng trên schema tiền đề tương thích H2. PostgreSQL 16 fresh và upgrade trên bản restore production `986bc3c` đã pass trong container cô lập.

> **Post-deploy rollout audit 2026-10-29:** PR #6 đã merge tại `ed6f2ce`; CI, publish 7 images và Deploy VPS đều success; production health/class-search smoke test trả HTTP 200. Audit sau deploy phát hiện Compose chưa truyền hai biến tutor-absence vào Contract container và allowlist chỉ chứa token sai có thể bị hiểu thành global ENFORCE. Nhánh hardening bổ sung wiring Compose/production example, CI assertion, fail-closed sang SHADOW và runbook canary. Feature vẫn phải giữ `OFF` cho đến khi nhánh hardening được merge/deploy và các E2E còn thiếu hoàn tất.

> **Runtime correction sau PR #7/#8:** Nhánh hardening đã merge qua PR #7 và được deploy trong release `a1a1bdd`. Đối soát trực tiếp container xác nhận `TUTOR_ABSENCE_GOVERNANCE_MODE=SHADOW` và allowlist trống. Vì vậy yêu cầu “giữ OFF cho đến khi hardening được deploy” ở đoạn lịch sử trên đã được đáp ứng; verdict hiện tại là giữ `SHADOW`, không chuyển `ENFORCE` cho đến khi các gate E2E/Anvil/observability/browser còn thiếu hoàn tất.

### Release verdict hiện tại

- Được phép tiếp tục phát triển/test với `TUTOR_ABSENCE_GOVERNANCE_MODE=OFF`, production `SHADOW` hoặc local canary có kiểm soát.
- Chưa được chuyển production sang `ENFORCE` trước khi hoàn thành live-process cross-service E2E (contract test JWT/payload đã PASS), Anvil time-warp/refund E2E, notification/metrics chuyên biệt và browser walkthrough. Runbook deploy/canary đã có tại `deploy/TUTOR_ABSENCE_CANARY_RUNBOOK.md`.
- `Plan/PLAN_TUTOR_ABSENCE_GOVERNANCE.md` được giữ nguyên, không chỉnh sửa trong vòng safety audit này.

---

## 1. TỔNG QUAN KẾT QUẢ ĐÃ THỰC HIỆN

### 1.1. Cam kết an toàn & tính toàn vẹn (Code Integrity)
- **Regression suite đã chạy lại thành công (không đồng nghĩa production-ready)**:
  - `learning-service`: **273/273 test PASS** (0 failures, 0 errors).
  - `contract-service`: **283 test run, 0 failures, 0 errors, 8 Anvil tests skipped**.
  - `frontend-web`: `tsc --noEmit` PASS; `npm run build` thành công trong **2.60s, exit code 0**; còn các cảnh báo dependency/chunk-size hiện hữu.
- **Kill-Switch an toàn**: Mặc định cấu hình `tutor-absence.governance-mode=OFF`.
- **Dữ liệu cũ (Backward Compatibility)**: Toàn bộ case cũ có `absence_governance_version = null` vẫn vận hành theo luồng cũ, không bị ảnh hưởng logic mới.
- **Không có lịch bù**: Đã loại bỏ hoàn toàn việc phát sinh buổi bù hay sửa đổi số buổi trên Smart Contract và cơ sở dữ liệu.

---

## 2. CHI TIẾT CÁC FILE ĐÃ TẠO VÀ CHỈNH SỬA

### A. Database Migrations (Additive - Chỉ thêm mới, không xóa sửa cột cũ)
1. [`backend/contract-service/src/main/resources/db/migration/V22__tutor_absence_governance.sql`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/resources/db/migration/V22__tutor_absence_governance.sql)
   - Mở rộng bảng `termination_case` thêm các trường quản trị: `absence_governance_version`, `trigger_session_sequence`, `next_session_sequence`, `next_session_start_at`, `hold_effective_at`, `hold_command_id`, `decision_deadline`, `auto_decision_reason`.
   - Tạo bảng `tutor_absence_probation` theo dõi lớp trong thời gian thử thách (ACTIVE, PASSED, FAILED, CANCELLED).
   - Tạo bảng `class_tutor_attendance_signal` lưu chiếu tín hiệu điểm danh cấp lớp.
2. [`backend/learning-service/src/main/resources/db/migration/V17__absence_governance_safety.sql`](file:///d:/KL/khoaluan/KLTN_Edu/backend/learning-service/src/main/resources/db/migration/V17__absence_governance_safety.sql)
   - Thêm cột `attendance_finalized_at` vào bảng `class_sessions`.
   - Tạo bảng `learning_termination_command_inbox` đảm bảo xử lý lệnh HOLD/RELEASE idempotent liên dịch vụ.

### B. Backend Learning-Service
1. [`ClassSession.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/learning-service/src/main/java/iuh/fit/learning_service/entity/ClassSession.java): Mapping trường `attendanceFinalizedAt`.
2. [`LearningTerminationCommandInbox.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/learning-service/src/main/java/iuh/fit/learning_service/entity/LearningTerminationCommandInbox.java) & [`LearningTerminationCommandInboxRepository.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/learning-service/src/main/java/iuh/fit/learning_service/repository/LearningTerminationCommandInboxRepository.java): Lưu trữ và khóa idempotency cho các lệnh đóng băng/giải phóng lớp.
3. [`SessionSettlementDeliveryService.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/learning-service/src/main/java/iuh/fit/learning_service/service/SessionSettlementDeliveryService.java): Tính toán outcome gia sư cấp cả lớp (`TUTOR_PRESENT`, `TUTOR_ABSENT`, `INCONSISTENT`, `UNAVAILABLE`) và snapshot thông tin buổi kế tiếp `N+1`.
4. [`ContractServiceDispatcher.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/learning-service/src/main/java/iuh/fit/learning_service/service/ContractServiceDispatcher.java): Chuyển tín hiệu điểm danh cấp lớp và payload đầy đủ sang Contract.
5. [`LearningTerminationService.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/learning-service/src/main/java/iuh/fit/learning_service/service/LearningTerminationService.java): Kiểm tra inbox idempotent, hỗ trợ `AUTO_TUTOR_ABSENCE` và `AUTO_TUTOR_ABSENCE_RELAPSE`, chặn release quá hạn `releaseNotAfter`.

### C. Backend Contract-Service
1. [`TutorAbsenceGovernanceProperties.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/config/TutorAbsenceGovernanceProperties.java): Quản lý mode `OFF`, `SHADOW`, `ENFORCE` và canary allowlist theo `classroomId`.
2. [`ClassTutorAttendanceSignal.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/entity/ClassTutorAttendanceSignal.java) & [`ClassTutorAttendanceSignalRepository.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/repository/ClassTutorAttendanceSignalRepository.java): Entity và repository lưu tín hiệu cấp lớp.
3. [`TutorAbsenceProbation.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/entity/TutorAbsenceProbation.java) & [`TutorAbsenceProbationRepository.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/repository/TutorAbsenceProbationRepository.java): Quản lý trạng thái thử thách.
4. [`TutorAbsenceDeadlinePolicy.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/service/TutorAbsenceDeadlinePolicy.java): Tính toán chuẩn 2 deadline độc lập:
   - `evidenceDeadline = min(T0 + 24h, S - 12h)`
   - `decisionDeadline = S`
   - Bắt lỗi khi `S - 12h <= T0` -> `INSUFFICIENT_REVIEW_WINDOW`.
5. [`TutorAttendanceSignalService.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/service/TutorAttendanceSignalService.java): Ingestion tín hiệu idempotent và phát hiện mâu thuẫn payload.
6. [`TerminationSignals.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/service/TerminationSignals.java): Thuật toán dò 3 buổi vắng liên tiếp cấp lớp và phát hiện tái phạm (relapse) ở buổi probation $N+1$.
7. [`TerminationService.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/service/TerminationService.java):
   - Chặn nộp giải trình nếu `now >= responseDeadline`.
   - Chặn Admin `REJECT` nếu `now >= decisionDeadline`.
   - Xử lý hết hạn bằng bi-directional row lock: `NO_TUTOR_RESPONSE`, `NO_ADMIN_DECISION`, `RELEASE_TIMEOUT`, `HOLD_SYNC_TIMEOUT`.
   - Tự động sinh `TutorAbsenceProbation` khi Admin `REJECT` (cho tiếp tục).
8. [`TerminationScheduler.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/service/TerminationScheduler.java): Quét định kỳ các case hết hạn response, hết hạn decision, quá hạn release hoặc quá hạn hold sync.
9. [`ContractManagementController.java`](file:///d:/KL/khoaluan/KLTN_Edu/backend/contract-service/src/main/java/iuh/fit/contract_service/api/ContractManagementController.java): Tiếp nhận request tự động từ Learning.

### D. Frontend-Web
1. [`terminationsApi.ts`](file:///d:/KL/khoaluan/KLTN_Edu/frontend-web/src/api/terminationsApi.ts): Định nghĩa kiểu dữ liệu `TutorAbsenceProbation`, mở rộng các trường SLA deadline, trigger sequence, probation info.
2. [`TerminationPanel.tsx`](file:///d:/KL/khoaluan/KLTN_Edu/frontend-web/src/components/contract/TerminationPanel.tsx):
   - Phân biệt rõ 2 mốc thời gian: Hạn gia sư giải trình và Hạn Admin ra quyết định.
   - Thêm banner cảnh báo khi lớp đang trong diện thử thách (Probation).
   - Vô hiệu hóa nút gửi của gia sư khi quá hạn giải trình; vô hiệu hóa nút cho phép tiếp tục của Admin khi quá hạn quyết định.
   - Xóa bỏ hoàn toàn các trường và câu chữ yêu cầu gia sư đề xuất "lịch dạy bù".

---

## 3. BẰNG CHỨNG KIỂM THỬ ĐÃ THỰC HIỆN

### Test Suites trên `contract-service` (đã chạy thành công):
- `ContractSchemaMigrationTest`: 10/10 PASS
- `TerminationSchedulerTest`: 1/1 PASS
- `TerminationSignalsTest`: 9/9 PASS
- `TutorAbsenceDeadlinePolicyTest`: 7/7 PASS
- `TutorAbsenceGovernanceFlowTest`: 9/9 PASS
- `TutorAttendanceSignalServiceTest`: 5/5 PASS
- `TutorAbsenceGovernancePropertiesTest`: 6/6 PASS
- `AdminFinancialMonitoringControllerTest`: 1 governance payload-forwarding test PASS (5/5 toàn class).
- **Tổng cộng**: 48 test mục tiêu PASS. Toàn bộ test suite chạy 283 test, 0 failures, 0 errors (8 Anvil tests được skip theo cấu hình môi trường).

### Test Suites trên `learning-service` (đã chạy thành công):
- `LearningTerminationServiceTest`: 22/22 PASS
- `SessionSettlementDeliveryServiceTest`: 6/6 PASS
- `LearningSchemaMigrationTest`: 2/2 PASS
- `ContractServiceDispatcherTest`: 1/1 PASS (payload snapshot đầy đủ và scoped service JWT).
- **Tổng cộng**: 31 test mục tiêu PASS. Toàn bộ test suite 273 test của service PASS.

### Build Frontend:
- Lệnh chạy: `npm run build` tại `frontend-web`.
- Kết quả: `tsc --noEmit` PASS; production build hoàn tất trong 2.60s với exit code 0. Build còn cảnh báo dependency/pure-annotation/chunk-size, không có lỗi chặn build.

### PostgreSQL 16 migration rehearsal:
- Fresh database: toàn bộ Account V1–V3, Learning V1–V17, Contract V1–V22 và Notification V1–V6 được áp dụng thành công; Flyway history/checksum đều hợp lệ.
- Production restore: file `kltn_db_prod_986bc3c.sql` được xác minh SHA-256 `E342ACE76FB272561223C4E738CB33461C5FFDFCD54F62540ACB1625776E4777`, restore vào container không network/không publish port, sau đó chỉ Learning V17 và Contract V22 được áp dụng.
- Checksum: Learning V17 `228733390`; Contract V22 `1652972676`; cả hai `success=true`.
- Legacy postcondition: 41 `class_rooms`, 44 `class_sessions`, 1 `contract_agreement` được giữ nguyên; 44 session cũ có governance columns `NULL`; không có governance case/probation/signal/inbox bị backfill.
- Hai container rehearsal đã được xóa sau kiểm tra; database local/production gốc không bị truy cập hoặc thay đổi.

---

## 4. BƯỚC TIẾP THEO CHO BUỔI LÀM VIỆC TỚI
1. **Kiểm tra trực quan trên trình duyệt (UI Demo / Walkthrough)**:
   - Khởi động frontend và backend với 1 lớp mẫu để kiểm tra hiển thị thời hạn, banner thử thách và các nút bấm.
2. **Kịch bản kiểm thử giả lập E2E**:
   - Thử nghiệm bắn tín hiệu 3 buổi vắng liên tiếp với cờ `ENFORCE` trên 1 lớp mẫu để xác nhận toàn bộ quy trình: HOLD -> Cửa sổ giải trình -> Admin duyệt thử thách (hoặc Worker tự hủy khi hết hạn).
3. **Chuẩn bị tích hợp**:
   - Khi người dùng xác nhận đạt yêu cầu, tiến hành review commit và chuẩn bị hợp nhất vào nhánh chính.
