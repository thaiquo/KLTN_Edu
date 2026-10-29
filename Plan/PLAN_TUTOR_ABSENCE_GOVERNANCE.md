# Kế hoạch quản trị Gia sư vắng liên tiếp, thời hạn giải trình và probation

> Trạng thái: **SPEC REVIEWED — CHƯA IMPLEMENT**  
> Ngày rà soát source: **2026-10-27**  
> Phạm vi: `contract-service`, `learning-service`, `frontend-web`, notification/outbox, Contract V22 và Learning V17.  
> Nguồn tham chiếu: `docs/BUSINESS_RULES.md`, `docs/BLOCKCHAIN.md`, source hiện tại và `Plan/PLAN_ESCROW_COOLING_OFF_TRIAL.md`.

## 0. Kết luận sau khi đối chiếu source

Source hiện tại đã có phần lớn nền móng và phải được tái sử dụng:

- `TerminationSignals` phát hiện 3 settlement có sequence liên tiếp và outcome `TUTOR_ABSENT`.
- `TerminationService` tạo whole-class case `AUTO_TUTOR_ABSENCE`, gửi `HOLD`, lưu `responseDeadline`, nhận phản hồi/minh chứng, cho Staff `RECOMMEND` và chỉ Admin `APPROVE`, `FORCE_APPROVE`, `REJECT`.
- `TerminationScheduler` retry `HOLD_PENDING`/`RELEASE_PENDING` và xử lý case `APPROVED`.
- `TerminationProcessor` đã chờ settlement hoàn tất, gọi luồng cancel hiện có, chờ event hoàn tiền rồi mới đóng case.
- `LearningTerminationService` đã xóa attendance tương lai khi `HOLD`, tạo lại attendance khi `RELEASE`, khóa/cancel session khi `FREEZE/CLOSE`; không có logic sinh buổi bù.
- Frontend đã có cảnh báo, deadline, upload evidence, `FORCE_APPROVE` và tracker hoàn tiền.

Các phần **chưa có**:

- Không có worker tự quyết định khi hết hạn.
- Không có state probation bền vững và không có phát hiện tái phạm ở buổi kế tiếp.
- Chưa persist riêng mốc bắt đầu buổi kế tiếp/decision deadline; một `responseDeadline` không đủ cho hai SLA.
- Tutor vẫn có thể gửi phản hồi/evidence sau deadline nếu case chưa đổi trạng thái.
- Whole-class absence hiện có thể được kích hoạt từ một agreement; chưa xác nhận đồng thuận outcome của mọi agreement đang hoạt động trong lớp.
- UI vẫn yêu cầu “lịch bù”, trái với quy tắc mới.

Vì hệ thống đã chạy production, tính năng tự động ra quyết định tài chính phải có kill switch mặc định OFF, shadow mode và canary; không được triển khai như thay đổi bật ngay.

## 1. Quy tắc nghiệp vụ chính thức

### 1.1. Không hard-code “Buổi 4”

Quy tắc áp dụng cho **ba buổi liên tiếp bất kỳ**, không chỉ Buổi 1–3:

- Chuỗi vi phạm kết thúc ở sequence `N`.
- Cutoff cố định là `N`.
- Buổi probation là buổi hợp lệ kế tiếp `N + 1` lấy từ Learning snapshot. Trong tình huống đầu khóa, đây mới là Buổi 4.
- Mọi API/UI phải hiển thị sequence thực tế, không ghi cứng “Buổi 4”.

### 1.2. Điều kiện phát hiện

Chỉ kích hoạt `AUTO_TUTOR_ABSENCE` khi:

1. Learning — service sở hữu lớp, session và attendance — đã chốt tín hiệu gia sư vắng ở cấp lớp cho ba sequence phân biệt `N-2`, `N-1`, `N`.
2. Mỗi tín hiệu có `sourceEventId` bất biến, `learningSessionId`, `finalizedAt` và outcome cấp lớp; Contract lưu projection idempotent trước khi dò chuỗi vi phạm.
3. Contract không suy ra việc gia sư vắng cả lớp từ settlement của riêng một Student. Settlement theo agreement vẫn là nguồn cho dòng tiền, không phải nguồn chân lý để đếm vi phạm cấp lớp.
4. Nếu dữ liệu settlement giữa các agreement mâu thuẫn với tín hiệu final của Learning thì giữ case ở shadow/manual review, phát cảnh báo vận hành và không auto-cancel.
5. Lớp còn ít nhất một buổi tương lai. Nếu không còn buổi, settlement tiếp tục bình thường và không mở probation/cancel pipeline mới.

Ba khiếu nại được duyệt vẫn dùng `SYSTEM_REVIEW` như source hiện tại; không tự động nhập vào chính sách probation này.

### 1.3. HOLD và cutoff bất biến

Khi trigger hợp lệ:

1. Contract tạo case whole-class với `origin=AUTO_TUTOR_ABSENCE`, `governanceVersion=1`.
2. Persist trước các dữ liệu pháp lý/vận hành: trigger sequence `N`, requested cutoff `N`, `detectedAt`, hold command id và snapshot buổi `N+1` do Learning gửi kèm tín hiệu finalization.
3. Đặt cutoff fence trên các agreement liên quan trước khi gọi liên service để Contract không đề xuất settlement sau `N` trong lúc Learning lỗi.
4. Gửi lệnh `HOLD` idempotent sang Learning với cutoff `N`; retry không được tính lại cutoff theo `now`.
5. Chỉ sau khi Learning xác nhận HOLD, Contract ghi `holdEffectiveAt`, tính deadline đúng một lần và gửi thông báo mở cửa sổ giải trình.
6. Learning xóa attendance sau cutoff và chặn điểm danh, nhưng không sinh, dời hoặc chèn session.

### 1.4. Hai deadline độc lập

Ký hiệu:

- `T0`: `holdEffectiveAt`, tức thời điểm Contract nhận xác nhận Learning đã áp dụng HOLD; `detectedAt` được lưu riêng để audit và theo dõi độ trễ liên dịch vụ.
- `S`: thời điểm bắt đầu buổi kế tiếp `N+1`, lấy từ Learning snapshot và persist bất biến.
- `evidenceDeadline = min(T0 + 24h, S - 12h)`.
- `decisionDeadline = S`.

Luồng quyết định:

- Tutor không phản hồi trước `evidenceDeadline` → hệ thống tự phê duyệt hủy.
- Tutor phản hồi đúng hạn → Staff/Admin được thẩm định đến trước `decisionDeadline`.
- Đến `decisionDeadline` mà chưa hoàn tất quyết định cho tiếp tục và `RELEASE` chưa thành công → hệ thống tự phê duyệt hủy.
- So sánh biên dùng `now >= deadline` là hết hạn; thời gian lưu UTC, hiển thị `Asia/Ho_Chi_Minh`.

Trường hợp `S - 12h <= T0` không có cửa sổ thẩm định an toàn. Không được “hoãn Buổi N+1 rồi mở lại muộn” vì source không có reschedule và việc release một session đã qua giờ gây sai attendance/settlement. Với governance v1, case chuyển sang auto-cancel với lý do `INSUFFICIENT_REVIEW_WINDOW`; nếu muốn hoãn chính thức phải thiết kế một tính năng reschedule/refund riêng.

Nếu HOLD chưa đồng bộ được mà đã tới `S`, hệ thống auto-approve với `HOLD_SYNC_TIMEOUT`, giữ cutoff fence ở Contract và tiếp tục retry luồng FREEZE/CLOSE; phải phát cảnh báo mức cao vì Learning chưa chứng minh được việc chặn điểm danh. Không mở cửa sổ giải trình khi HOLD còn `HOLD_PENDING`.

### 1.5. Quyền con người

- Tutor chỉ được `RESPOND` hoặc upload evidence khi `now < evidenceDeadline`.
- Staff được thẩm định và `RECOMMEND`; Staff không được quyết định tài chính.
- Khi evidence không hợp lệ trước lúc hồ sơ đủ điều kiện `APPROVE` thông thường, Admin dùng luồng hiện có `FORCE_APPROVE` (UI hiển thị “Duyệt hủy ngay”) và bắt buộc lý do audit; không tạo action thứ hai cùng nghĩa.
- `APPROVE` tiếp tục là quyết định thông thường sau khi hồ sơ đã đủ điều kiện theo SLA hiện hữu.
- Admin chỉ được `REJECT` để cho tiếp tục khi Tutor đã phản hồi đúng hạn, `now < decisionDeadline`, case còn hợp lệ và Learning `RELEASE` thành công trước giờ buổi probation.

### 1.6. Probation

Khi Admin cho tiếp tục:

1. Tạo probation record ACTIVE cho `(classroomId, sourceCaseId, sessionSequence=N+1)`.
2. Gửi `RELEASE`; chỉ chuyển source case sang `REJECTED` sau khi Learning xác nhận release.
3. Nếu release bị lỗi đến `decisionDeadline`, không release muộn; auto-cancel case để tránh mở lại attendance của một session đã bắt đầu.
4. Tại sequence probation:
   - Toàn lớp xác nhận Tutor có mặt (`BOTH_PRESENT` hoặc `STUDENT_ABSENT_TUTOR_PRESENT`) → probation `PASSED`.
   - Toàn lớp xác nhận `TUTOR_ABSENT` → probation `FAILED`, tạo case `AUTO_TUTOR_ABSENCE_RELAPSE` với cutoff đúng sequence probation và phê duyệt hủy tự động, không có vòng giải trình thứ hai.
   - Outcome thiếu/mâu thuẫn → giữ ACTIVE và cảnh báo; không tự hủy từ dữ liệu không đầy đủ.

### 1.7. Ý nghĩa “hủy ngay” và dòng tiền

“Hủy ngay” nghĩa là quyết định quản trị/cutoff được commit ngay. Không được thông báo rằng USDC đã về ví ngay:

- Ba buổi `TUTOR_ABSENT` có phân bổ `0/0/100`, nhưng tiền chỉ được coi là đã hoàn sau khi settlement hoàn tất và event chain được ingest.
- Escrow V1 không cho `cancelAgreementAndRefundUnused` khi còn `openSessions`.
- `TerminationProcessor` phải tiếp tục chờ các settlement đã mở kết thúc, sau đó mới cancel phần cọc chưa dùng và chờ `UNUSED_AMOUNT_REFUNDED`.
- UI phải phân biệt `đã quyết định hủy`, `đang chờ settlement`, `đang gửi cancel`, `đã xác nhận hoàn tiền`.

### 1.8. Không có lịch bù chính thức

- Không tạo thêm sequence, không tăng `totalSessions`, không sửa terms/hash và không tạo “buổi bù” trên blockchain.
- Xóa mọi wording/mẫu form yêu cầu Tutor đề xuất lịch bù trong `TerminationPanel`.
- Nếu các bên tự phụ đạo ngoài nền tảng thì không thuộc lịch, escrow hay trách nhiệm tài chính của EduConnect.

## 2. State machine tương thích source

Không thêm `PROBATION` hoặc `COMPLETED_PROBATION` vào `termination_case.status`. Giữ state machine hiện hữu:

| Case state | Sự kiện | Next state | Ghi chú |
| --- | --- | --- | --- |
| `HOLD_PENDING` | Learning HOLD thành công | `REQUESTED` | Snapshot/cutoff/deadline đã persist. |
| `HOLD_PENDING` | `now >= S` trước khi HOLD thành công | `APPROVED` | `HOLD_SYNC_TIMEOUT`; tiếp tục retry FREEZE, không giả vờ HOLD đã thành công. |
| `REQUESTED` | Tutor phản hồi đúng hạn | `REQUESTED` | Ghi `tutorRespondedAt`; chờ review. |
| `REQUESTED` | Không phản hồi và `now >= evidenceDeadline` | `APPROVED` | System auto-decision. |
| `REQUESTED/RECOMMENDED` | Admin hủy | `APPROVED` | Tái sử dụng termination items/processor. |
| `REQUESTED/RECOMMENDED` | Admin cho tiếp tục | `RELEASE_PENDING` | Tạo probation ACTIVE trước release. |
| `RELEASE_PENDING` | Learning RELEASE thành công trước S | `REJECTED` | Probation vẫn ACTIVE ở bảng riêng. |
| `RELEASE_PENDING` | `now >= S` trước khi release thành công | `APPROVED` | Không release session đã bắt đầu. |
| `APPROVED` | Items hoàn tất | `COMPLETED` | Luồng hiện hữu. |

Probation có state riêng: `ACTIVE -> PASSED | FAILED | CANCELLED`.

## 3. Migration Contract V22 — additive và backward-compatible

File: `V22__tutor_absence_governance.sql`.

### 3.1. Mở rộng `termination_case`

Thêm nullable columns:

- `absence_governance_version SMALLINT`
- `trigger_session_sequence INTEGER`
- `next_session_sequence INTEGER`
- `next_session_start_at TIMESTAMP WITH TIME ZONE`
- `hold_effective_at TIMESTAMP WITH TIME ZONE`
- `hold_command_id UUID`
- `release_command_id UUID`
- `decision_deadline TIMESTAMP WITH TIME ZONE`
- `auto_decision_at TIMESTAMP WITH TIME ZONE`
- `auto_decision_reason VARCHAR(40)`

`response_deadline` hiện có được dùng làm evidence deadline. Chỉ case mới có `absence_governance_version=1`; không backfill case legacy.

CHECK constraints có điều kiện theo version:

- version null hoặc bằng 1;
- với version 1: trigger > 0, next > trigger, `response_deadline <= decision_deadline`, next start/decision deadline không null;
- `auto_decision_at` và `auto_decision_reason` cùng null hoặc cùng có giá trị;
- reason nằm trong `NO_TUTOR_RESPONSE`, `NO_ADMIN_DECISION`, `INSUFFICIENT_REVIEW_WINDOW`, `HOLD_SYNC_TIMEOUT`, `PROBATION_RELAPSE`, `RELEASE_TIMEOUT`.

### 3.2. Bảng probation riêng

Tạo `tutor_absence_probation`:

- `id UUID PRIMARY KEY`
- `classroom_id BIGINT NOT NULL`
- `source_case_id UUID NOT NULL UNIQUE REFERENCES termination_case(id)`
- `session_sequence INTEGER NOT NULL CHECK (session_sequence > 0)`
- `session_start_at TIMESTAMP WITH TIME ZONE NOT NULL`
- `status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE','PASSED','FAILED','CANCELLED'))`
- `failure_case_id UUID UNIQUE REFERENCES termination_case(id)`
- `resolved_at`, `created_at`, `updated_at`, `version`

Tạo unique partial index chỉ cho một probation ACTIVE trên mỗi classroom.

### 3.3. Projection tín hiệu attendance cấp lớp

Tạo `class_tutor_attendance_signal` trong Contract như một integration projection, không phải bản sao domain Learning:

- `id UUID PRIMARY KEY`
- `classroom_id BIGINT NOT NULL`
- `learning_session_id BIGINT NOT NULL`
- `session_sequence INTEGER NOT NULL CHECK (session_sequence > 0)`
- `tutor_attendance_outcome VARCHAR(20) NOT NULL CHECK (tutor_attendance_outcome IN ('TUTOR_PRESENT','TUTOR_ABSENT','INCONSISTENT','UNAVAILABLE'))`
- `finalized_at TIMESTAMP WITH TIME ZONE NOT NULL`
- `source_event_id VARCHAR(100) NOT NULL UNIQUE`
- `created_at TIMESTAMP WITH TIME ZONE NOT NULL`
- unique `(classroom_id, session_sequence)`
- unique `(classroom_id, learning_session_id)`

Mở rộng `InternalAutoProposeRequest` hiện có theo hướng backward-compatible với `learningSessionId`, `sessionSequence`, `tutorAttendanceOutcome`, `finalizedAt`, `sourceEventId`, `nextSessionSequence`, `nextSessionStartAt`. Path parameter hiện đang mang sequence dù tên là `sessionId`; không tiếp tục dựa vào sự nhập nhằng này trong code mới. Replay cùng event/payload là no-op; cùng classroom/sequence nhưng payload khác phải bị quarantine và cảnh báo, tuyệt đối không ghi đè âm thầm.

Learning chỉ phát `TUTOR_ABSENT` khi ledger attendance không rỗng, mọi record đã final và mọi record đều là `TUTOR_ABSENT`. Nếu mọi record đều thuộc nhóm xác nhận Tutor đã check-in thì phát `TUTOR_PRESENT`; trộn giữa present/absent là `INCONSISTENT`; ledger rỗng là `UNAVAILABLE`. Hai outcome sau vẫn cho pipeline settlement hiện hữu retry/xử lý an toàn, nhưng tuyệt đối không được tính vào chuỗi auto-cancel.

### 3.4. Index worker

- Partial index cho case v1 chưa phản hồi theo `(response_deadline, id)`.
- Partial index cho case v1 chưa quyết định/release theo `(decision_deadline, id)`.
- Partial index cho probation ACTIVE theo `(session_sequence, classroom_id)`.

Migration phải đặt transaction-local `lock_timeout`/`statement_timeout`, không sửa migration đã chạy, không backfill hoặc tự xử lý dữ liệu production trong DDL.

### 3.5. Learning V17 — finalization audit và command inbox

Tạo migration additive `V17__absence_governance_safety.sql`:

- thêm nullable `attendance_finalized_at`, `governance_next_session_sequence`, `governance_next_session_start_at` và `governance_snapshot_captured_at` vào `class_sessions`; chỉ set một lần, session legacy giữ null và không tự động vào governance v1;
- tạo `learning_termination_command_inbox` với khóa `(command_id, action)`, payload hash, trạng thái/kết quả snapshot và timestamps để replay trả lại cùng kết quả, còn payload khác cùng khóa bị từ chối;
- `sourceEventId` attendance được tạo deterministic từ classroom/session/version nên retry không sinh sự kiện mới.

Sau khi rolling generation hoàn tất, Learning chụp snapshot buổi kế tiếp đúng một lần trước lần giao signal v1 đầu tiên. Nếu `sequence < totalSessions` nhưng chưa có session kế tiếp, chưa phát signal governance và phải retry/cảnh báo; chỉ snapshot `next=null` khi lớp thực sự không còn buổi theo hợp đồng. Nhờ vậy cùng `sourceEventId` không đổi payload giữa các lần giao.

## 4. Thiết kế backend

### Phase A — Safety/configuration

- `TUTOR_ABSENCE_GOVERNANCE_MODE=OFF|SHADOW|ENFORCE`, mặc định `OFF` trong source, Compose và production example.
- `TUTOR_ABSENCE_GOVERNANCE_CLASSROOM_IDS` làm allowlist canary; `ENFORCE` nhưng không thuộc allowlist vẫn chỉ shadow.
- Tách constants/value objects cho origin, status và auto-decision reason; không rải string mới.

### Phase B — Detection và stable cutoff

- Learning phát tín hiệu tutor attendance đã final ở cấp classroom/session qua `SessionSettlementDeliveryService`/`ContractServiceDispatcher` hiện có; không tạo service mới.
- Contract internal endpoint lưu `class_tutor_attendance_signal` idempotently rồi mới kích hoạt detection.
- Refactor `TerminationSignals` đọc projection cấp lớp; settlement agreement chỉ dùng để kiểm tra dòng tiền và phát hiện bất thường, không dùng làm bộ đếm chính.
- Ưu tiên xử lý active probation trước quy tắc “ba buổi”.
- Mở rộng internal Learning command để chấp nhận stable whole-class cutoff cho `HOLD` và `FREEZE` thuộc `AUTO_TUTOR_ABSENCE`/`AUTO_TUTOR_ABSENCE_RELAPSE`.
- Snapshot HOLD phải trả cả `nextSessionSequence` và `nextSessionStart`; Contract đối chiếu với snapshot trong attendance signal trước khi mở cửa sổ giải trình.
- Persist cutoff fence và snapshot trước call; retry phải cùng `commandId`, cutoff và effective time.
- RELEASE mang `releaseCommandId`, `expectedHoldCommandId`, expected cutoff và `releaseNotAfter=S`; Learning tự kiểm tra `serverNow < releaseNotAfter` trước khi xóa stop/cutoff. Kiểm tra chỉ ở Contract là không đủ vì request có thể đến trễ qua mạng.
- Không tính deadline lại sau mỗi retry.

### Phase C — Deadline enforcement và auto-decision

- Thay hàm deadline hiện tại bằng policy component nhận `T0` và snapshot `S`; test mọi boundary.
- Chặn Tutor `RESPOND`/upload sau evidence deadline ở backend, không chỉ UI.
- Refactor logic tạo termination items từ `act(APPROVE/FORCE_APPROVE)` thành một transition dùng chung cho Admin và system.
- Nhánh `HOLD_SYNC_TIMEOUT` được phép tạo quyết định/items bằng system transition nhưng processor phải gửi stable `FREEZE` với đúng cutoff `N`; không được rơi về cách tính cutoff theo thời điểm retry.
- Mở rộng `TerminationScheduler` hiện có thay vì tạo scheduler cạnh tranh:
  - query candidate IDs theo index;
  - lock từng case bằng `PESSIMISTIC_WRITE`;
  - lock classroom/agreement, re-check state/deadline;
  - commit đúng một auto-decision/audit/items;
  - retry idempotent khi worker chạy đồng thời.
- Race `REJECT` vs auto-cancel: thao tác giữ lock trước thắng; thao tác sau nhận conflict rõ ràng.

### Phase D — Probation

- Khi Admin `REJECT`, tạo probation ACTIVE và chuyển `RELEASE_PENDING` trong cùng transaction.
- `synchronizeRelease` chỉ được release trước `decisionDeadline`; cả Contract và Learning cùng enforce fence này. Quá hạn chuyển sang auto-cancel, không khôi phục muộn.
- Detection đánh dấu `PASSED/FAILED` dựa trên outcome toàn lớp của đúng probation sequence.
- Relapse tạo case mới với detection key deterministic, stable cutoff và immediate system approval.

### Phase E — Notification/audit

- Dùng outbox/detection key deterministic cho: warning opened, evidence deadline expired, decision deadline expired, probation started, passed, relapse và refund completed.
- Audit phải ghi server timestamp, policy version, trigger/cutoff/probation sequence, actor `SYSTEM`, reason code và liên kết source/failure case.
- Notification không được tuyên bố “đã hoàn tiền” trước event chain.

## 5. Learning Service

Tái sử dụng `LearningTerminationService`, chỉ mở rộng phần cần thiết:

- Stable cutoff command cho hai origin absence mới, hỗ trợ whole-class `HOLD`.
- Idempotency phải kiểm tra command replay giống trial.
- `HOLD`: xóa attendance sequence > cutoff và chặn điểm danh.
- `RELEASE`: chỉ thực hiện trước probation start, xóa stop/cutoff và tạo lại attendance tương lai.
- Mọi HOLD/RELEASE governance v1 đi qua command inbox; stale RELEASE không được phép xóa một HOLD mới hơn.
- `FREEZE/CLOSE`: giữ logic hiện hữu; không tạo session mới.
- Thêm test chứng minh không có session count/sequence/date nào thay đổi qua HOLD/RELEASE.

HTTP 401 local và dữ liệu lớp cụ thể không được gộp vào feature nếu chưa tái hiện được bằng log/test. Tạo task chẩn đoán riêng: xác minh cùng `JWT_SECRET`, đúng `serviceScope=learning-termination`, URL service và clock; không sửa auth theo phỏng đoán.

## 6. Frontend

- API type thêm governance version, trigger/next sequence, evidence/decision deadline, auto-decision reason và probation DTO.
- Countdown dùng `serverNow`, không dùng đồng hồ máy người dùng làm nguồn quyết định.
- Hiển thị hai mốc riêng: “hạn Tutor phản hồi” và “hạn Admin cho tiếp tục”.
- Disable submit khi deadline hết nhưng luôn xử lý lỗi authoritative từ backend.
- Tái sử dụng nút `FORCE_APPROVE`; đổi label/giải thích, không tạo action trùng.
- Hiển thị `Đang probation — Buổi #N`; không hard-code #4.
- Xóa mẫu “lịch bù”, thay bằng lý do, minh chứng, thời điểm có thể tiếp tục và cam kết.
- Tracker tài chính phân biệt pending settlement/cancel/refund-confirmed.

## 7. Test bắt buộc

### Unit/state tests

- Ba tín hiệu cấp lớp liên tiếp; không nhân theo số Student; không trigger nếu thiếu sequence.
- Duplicate `sourceEventId` cùng payload là no-op; cùng classroom/sequence nhưng payload khác bị quarantine.
- Settlement của một Student không được kích hoạt whole-class case; agreement tham gia muộn không làm thay đổi lịch sử attendance cấp lớp.
- Ledger rỗng, outcome trộn hoặc session legacy thiếu `attendance_finalized_at` không được tính là một lần Tutor vắng cho auto-cancel.
- Chuỗi 5–7 phải tạo probation 8, không phải 4.
- Boundary `<`/`>=` ở cả hai deadline; timezone UTC/Hồ Chí Minh.
- `S-12h <= T0` → `INSUFFICIENT_REVIEW_WINDOW`.
- Tutor response/evidence đến trước deadline pass, đúng hoặc sau deadline fail.
- Admin REJECT sau decision deadline fail.

### Concurrency/idempotency

- Hai scheduler instance cùng expire một case → một audit, một bộ items.
- Evidence upload vs expiry, Admin REJECT vs expiry, RELEASE retry vs decision deadline.
- Response của RELEASE bị mất rồi retry phải trả cùng snapshot; RELEASE cũ đến sau HOLD mới phải fail bởi expected hold command.
- Duplicate signal/relapse không tạo duplicate case nhờ detection key/unique constraint.
- Learning replay lệch cutoff/command phải fail.

### Cross-service/integration

- 3 absence → stable HOLD → no attendance after cutoff.
- Valid response → probation → RELEASE trước giờ → attendance được tạo lại đúng, không thêm session.
- No response → system APPROVED → processor chờ settlement → cancel → refund event → COMPLETED.
- Probation absent → relapse immediate decision; probation present → PASSED.
- Multi-student whole-class cancellation không mất/nhân settlement.
- Service JWT test thật giữa Contract và Learning; không mock phần command boundary trong E2E chính.

### Blockchain/Anvil

- Ba `TUTOR_ABSENT` proposal chưa được mô tả là đã hoàn tiền.
- Warp qua dispute window, finalize đủ ba refund 0/0/100.
- Cancel chỉ sau `openSessions==0`; xác minh `UnusedAmountRefunded`, recipient, số dư và accounting invariant.
- Không có transaction/session bổ sung cho lịch bù.

### Migration/release

- H2 migration constraints cho Contract V22 và Learning V17.
- PostgreSQL 16 fresh + upgrade cả hai database từ bản restore production mới; đối chiếu Flyway checksum, row counts, constraints/index.
- Backup off-VPS, SHA-256 và restore rehearsal trước merge `main` vì auto-CD deploy thẳng production.

## 8. Rollout production

1. **R1 — Expand:** V22 + entity/repository/config, mode `OFF`; không đổi behavior.
2. **R2 — Shadow:** tính candidate/deadline/probation và metrics nhưng không auto-decision.
3. **R3 — Canary:** `ENFORCE` cho allowlist lớp thử nghiệm; theo dõi HOLD/RELEASE, scheduler lag, transaction/refund failures.
4. **R4 — Gradual:** mở rộng allowlist sau khi Anvil, cross-service E2E và Sepolia staging pass.
5. Kill switch chuyển về `OFF` phải dừng quyết định mới nhưng không được dừng recovery của case đã `APPROVED` hoặc transaction đang xử lý.

## 9. Definition of Done

- Không có case v1 treo quá decision deadline mà không có quyết định/audit hoặc cảnh báo lỗi rõ ràng.
- Không auto-cancel từ dữ liệu một Student khi whole-class outcome chưa nhất quán.
- Không release session đã bắt đầu và không tạo lịch bù.
- Cutoff không đổi qua retry; settlement sau cutoff bị chặn ở Contract và Learning.
- Chỉ event chain xác nhận mới được hiển thị là hoàn tiền thành công.
- Existing cases có governance version null tiếp tục hành vi cũ.
- Full Contract/Learning/frontend/Foundry regression pass; PostgreSQL fresh/upgrade rehearsal pass.
- Production mode vẫn `OFF` sau R1/R2; canary chỉ bật có chủ đích và có rollback/runbook.

## 10. Task order

- [x] `SPEC-01`: Chốt wording và short-notice rule trong `BUSINESS_RULES.md`/`BLOCKCHAIN.md`/`API.md`.
- [x] `DB-01`: Contract V22 conditional constraints/index + attendance signal projection + probation table.
- [x] `DB-02`: Learning V17 immutable finalization timestamp + command inbox.
- [x] `DB-03`: Entity/repository/fresh-upgrade migration tests cho cả hai service.
- [x] `SAFE-01`: Mode OFF/SHADOW/ENFORCE + classroom allowlist + metrics.
- [ ] `LEARN-01`: Phát tutor-attendance signal cấp lớp + stable whole-class command/idempotency tests.
- [ ] `BE-01`: Ingest projection idempotent + detection cấp lớp + stable cutoff snapshot.
- [ ] `BE-02`: Deadline policy + server-side submission guards.
- [ ] `BE-03`: Shared approval transition + expiry worker under row lock.
- [ ] `BE-04`: Probation lifecycle + relapse detection.
- [ ] `OUTBOX-01`: Durable notifications/audit.
- [ ] `WEB-01`: DTO/countdowns/probation badge/remove makeup wording.
- [ ] `TEST-01`: Unit/concurrency/full regression.
- [ ] `TEST-02`: Real cross-service + Anvil time-warp E2E.
- [ ] `OPS-01`: PostgreSQL production-restore rehearsal, backup/restore and canary runbook.
