# Trial & Termination Production Canary Checklist

> Cập nhật: 2026-11-03. Checklist này dành cho tài khoản/lớp thử nghiệm trên Sepolia. Không dùng người dùng thật hoặc coi kết quả là đạt nếu giao diện chỉ đổi trạng thái nhưng chưa có event blockchain xác nhận.

## 1. Trạng thái an toàn trước khi kiểm thử

- Release dự kiến: `b519528386bf2d56e6033b6d246b5c6132b17911`.
- Learning và Contract: `ESCROW_TRIAL_ENABLED=true`.
- Contract: `ESCROW_TRIAL_FUNDING_SAFETY_MARGIN=30m`.
- Tutor absence: `TUTOR_ABSENCE_GOVERNANCE_MODE=SHADOW`, allowlist trống.
- Không đổi tutor absence sang `ENFORCE` để chạy checklist trial.
- Dùng tài khoản Tutor, Student và Admin thử nghiệm; ghi lại email/ID nội bộ ở nơi riêng, không đưa dữ liệu cá nhân hoặc khóa ví vào Git.

## 2. Chuẩn bị lớp trial

- [ ] Tutor tạo lớp hoàn toàn mới, có ít nhất hai buổi hợp lệ.
- [ ] Buổi 1 và buổi 2 có ngày/giờ rõ ràng; buổi 2 diễn ra sau buổi 1 đủ thời gian để quan sát và opt-out.
- [ ] Ghi lại `classroomId`, lịch hai buổi và thời điểm dự kiến bắt đầu/kết thúc.
- [ ] Student gửi yêu cầu học; Tutor chấp nhận và hai bên ký EIP-712.
- [ ] Kiểm tra tài liệu hợp đồng chính thức có Trial Policy v1, Buổi #1, Buổi #2 và `trialDeadline` đúng bằng thời điểm bắt đầu Buổi #2.
- [ ] Ghi nhận riêng rằng bản preview trước ký hiện còn điều khoản cũ; không dùng preview đó làm bằng chứng rằng nội dung hợp đồng đã hoàn toàn chính xác.
- [ ] Student ký quỹ test USDC và chờ agreement chuyển `ACTIVE`, enrollment chuyển `ENROLLED`; không chỉ dựa vào transaction submitted.

## 3. Kịch bản A — Dừng học thử đúng hạn

- [ ] Hai phía thực hiện điểm danh Buổi #1 theo kịch bản đã chọn.
- [ ] Chờ Learning hoàn thành Buổi #1 và Contract hiển thị trial `DECISION_OPEN`.
- [ ] Xác nhận nút Student là `Dừng học thử`, deadline hiển thị trước Buổi #2 và countdown dựa trên thời gian server.
- [ ] Student ký yêu cầu opt-out trước deadline; ghi `serverReceivedAt`, `terminationCaseId` và trạng thái ban đầu.
- [ ] Xác nhận không có bước Admin duyệt cho `TRIAL_OPT_OUT`.
- [ ] Theo dõi lần lượt `HOLD/APPROVED` -> `WAITING_SETTLEMENT` -> `BLOCKCHAIN_PENDING` hoặc `WAITING_REFUND_EVENT` -> `COMPLETED`.
- [ ] Xác nhận tiền Buổi #1 được quyết toán theo attendance; phần cọc các buổi chưa học chỉ được ghi hoàn sau event `UNUSED_AMOUNT_REFUNDED` đúng agreement và đúng ví Student.
- [ ] Xác nhận enrollment của Student chuyển `CANCELLED`; các buổi sau cutoff không còn là lịch sắp tới nhưng lịch sử buổi cũ vẫn được giữ.
- [ ] Thử đăng ký một lớp khác trùng đúng khung giờ cũ để xác nhận lịch Student đã tái sử dụng được sau `COMPLETED`.
- [ ] Nếu đây là Student cuối cùng: lớp phải `CANCELLED`, buổi tương lai/đơn chờ bị hủy và Tutor có thể dùng lại khung giờ.
- [ ] Nếu lớp còn Student khác: lớp tiếp tục và lịch Tutor vẫn bị giữ; đây là kết quả đúng.

## 4. Kịch bản B — Không dừng trước deadline

- [ ] Dùng agreement/lớp test khác hoặc một Student test khác; hoàn thành Buổi #1 nhưng không opt-out trước Buổi #2.
- [ ] Xác nhận trial chuyển `CONTINUED` và nút dừng học thử không còn khả dụng.
- [ ] Xác nhận hợp đồng tiếp tục mà không ký lại hoặc nạp thêm quỹ.
- [ ] Nếu Student muốn nghỉ sau đó, giao diện dùng `Yêu cầu chấm dứt` thông thường và cần Admin quyết định.

## 5. Kịch bản C — Tutor đề xuất dừng cả lớp

- [ ] Tutor bấm `Đề xuất dừng lớp`; ghi `terminationCaseId` và cutoff.
- [ ] Trước quyết định cuối, xác nhận lịch đang HOLD nhưng Student/Tutor chưa được phép tái sử dụng khung giờ.
- [ ] Nhánh Admin từ chối: xác nhận `RELEASE_PENDING` -> `REJECTED`, attendance/lịch tương lai được khôi phục.
- [ ] Nhánh Admin duyệt: xác nhận lớp `LOCKED`, các buổi đến cutoff được quyết toán, phần chưa dùng được hoàn on-chain và chỉ sau refund event mới CLOSE từng agreement.
- [ ] Khi toàn bộ item `COMPLETED`, xác nhận lớp `CANCELLED` và cả Student lẫn Tutor có thể tái sử dụng lịch.

## 6. Tutor vắng ba buổi — chỉ quan sát SHADOW

- [ ] Có thể tạo attendance outcome `TUTOR_ABSENT` để kiểm tra signal/candidate log.
- [ ] Trong `SHADOW`, hệ thống không được tạo termination case tự động, không HOLD lịch, không tạo probation và không tự hủy lớp.
- [ ] Không chuyển global `ENFORCE` hoặc để allowlist trống. Canary cưỡng chế là một đợt riêng theo `deploy/TUTOR_ABSENCE_CANARY_RUNBOOK.md`, chỉ cho đúng một classroom ID sau khi các gate còn thiếu hoàn tất.

## 7. Bằng chứng cần lưu sau mỗi kịch bản

- `classroomId`, `agreementId`, `terminationCaseId`, cutoff và trạng thái cuối.
- Thời điểm server của trial deadline/opt-out hoặc absence response/decision deadline.
- Transaction hash đăng ký agreement, funding, settlement/cancellation/refund liên quan.
- Event xác nhận cuối và số tiền theo base unit/USDC hiển thị.
- Ảnh giao diện trước/sau và kết quả thử đăng lớp trùng giờ của Student/Tutor.
- Log lỗi nếu trạng thái đứng lâu; không kết luận hoàn tiền chỉ từ nhãn `APPROVED`.

## 8. Tiêu chí đạt

Canary chỉ đạt khi đồng thời có đủ: trạng thái nghiệp vụ cuối đúng, settlement/refund event đúng, số tiền đúng, enrollment/class đúng và lịch được tái sử dụng đúng đối tượng. Nếu thiếu một trong các bằng chứng này, giữ tutor absence ở `SHADOW` và không tuyên bố trial production E2E hoàn tất.
