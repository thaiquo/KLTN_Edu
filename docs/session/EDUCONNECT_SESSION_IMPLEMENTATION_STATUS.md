# EduConnect — Trạng thái Session, Attendance, Escrow và Dispute

> Cập nhật theo source/test/runtime đến **2026-09-14**.  
> Kế hoạch và quy tắc thiết kế: [EDUCONNECT_SESSION_ATTENDANCE_ESCROW_MASTER_PLAN.md](EDUCONNECT_SESSION_ATTENDANCE_ESCROW_MASTER_PLAN.md).

## 1. Kết luận

Flow Web chính từ buổi học → điểm danh → đề xuất settlement → chờ 24 giờ → payout/refund hoặc dispute đã được triển khai và có bằng chứng Sepolia cho payout `BOTH_PRESENT` và refund `TUTOR_ABSENT`.

Không gọi toàn bộ hệ thống “100% production-ready”: Solidity V1 chỉ hỗ trợ dispute on-chain cho `BOTH_PRESENT`; runtime phụ thuộc RPC/gas/S3 và chỉ hỗ trợ một operator instance.

## 2. Thành phần đã triển khai

| Lớp | Thành phần | Trạng thái | Bằng chứng chính |
| --- | --- | --- | --- |
| DB | `class_sessions`, `session_attendances` | IMPLEMENTED | Learning migrations V27–V30. |
| DB | `session_settlement`, `dispute`, `dispute_evidence`, transaction/event audit | IMPLEMENTED | Contract migrations V1–V11. |
| Backend | Rolling session generation | IMPLEMENTED | `RollingSessionService`. |
| Backend | Startup/periodic auto-finalize | IMPLEMENTED | `ClassroomLifecycleScheduler`, 60 giây. |
| Backend | Independent check-in và outcome | IMPLEMENTED | `SessionAttendanceService`. |
| Backend | Retry delivery sang Contract | IMPLEMENTED | `SessionSettlementDeliveryService`, 30 giây. |
| Backend | Proposal/finalize/event projection | IMPLEMENTED | `SessionSettlementWorkflowService`, blockchain workers. |
| Backend | Dispute/history/evidence/arbitration | IMPLEMENTED + LIMITED | `DisputeWorkflowService`, controllers, S3 storage; V1 `BOTH_PRESENT` only. |
| Web | Student class workspace/timeline/link/homework | IMPLEMENTED | `StudentClassManagement`, `ClassSessionsTimeline`. |
| Web | Tutor session management | IMPLEMENTED | `TutorSessionManagement`, shared timeline. |
| Web | Student/Tutor/Admin/Staff dispute UI | IMPLEMENTED | `DisputeManagementPanel`, Student complaints routes. |
| Web | Wallet/settlement history | IMPLEMENTED | `MyWalletView`, contract APIs. |
| Mobile | Session/dispute flow | NOT_IMPLEMENTED | Mobile mới có auth/home cơ bản. |

## 3. Session lifecycle

```text
SCHEDULED → IN_PROGRESS (khi có hoạt động phù hợp) → COMPLETED
     └────────────────────────────────────────────→ CANCELLED
```

- Session được sinh cuốn chiếu từ lịch cố định của classroom, không tạo toàn bộ khóa vô hạn từ đầu.
- Scheduler chạy khi Learning Service ready và mỗi 60 giây, chọn session `SCHEDULED/IN_PROGRESS` đã qua ngày/giờ kết thúc.
- Sau khi chốt, session giữ `settlementDispatched=false` cho tới khi Contract Service xác nhận đã nhận đầy đủ danh sách proposal.
- Delivery worker đọc tối đa 50 bản ghi mỗi vòng, chạy sau 5 giây và mỗi 30 giây; lỗi REST không được đánh dấu là đã gửi.

## 4. Điểm danh và quyền truy cập

- Cửa sổ check-in: đúng `sessionDate` và `startTime <= now < endTime`.
- Student chỉ check-in cho chính Student hiện tại.
- Tutor check-in đánh dấu Tutor có dạy trên các attendance liên quan, không thay đổi `studentChecked`.
- Tutor được xem ai đã/chưa check-in.
- Hết giờ:
  - Tutor + Student có mặt → `BOTH_PRESENT`.
  - Tutor có mặt, Student vắng → `STUDENT_ABSENT_TUTOR_PRESENT`.
  - Tutor không có mặt, kể cả cả hai vắng → `TUTOR_ABSENT`.

### Link phòng học

- Lưu tại `class_rooms.meeting_link`.
- Tutor có thể cập nhật khi link hỏng; API/session sau đó đọc link mới.
- Student phải điểm danh ở từng buổi rồi mới gọi được endpoint lấy link.
- Gate link giảm gian lận/quên điểm danh, nhưng không phải bằng chứng tuyệt đối về thời lượng tham gia cuộc gọi bên thứ ba.

### Bài tập

- Mỗi session có topic, title, description và attachment URL.
- Student chưa check-in không nhận description/file URL từ response.
- Student đã check-in có thể nộp nội dung/file trên attendance record; Tutor xem và review theo flow hiện có.

## 5. Settlement per Student

Một classroom có nhiều Student nhưng mỗi Student có agreement và escrow riêng. Learning gửi outcome theo `studentId`; Contract tạo settlement riêng cho từng agreement.

| Outcome | Tutor | Platform | Student |
| --- | ---: | ---: | ---: |
| `BOTH_PRESENT` | 85% | 15% | 0% |
| `STUDENT_ABSENT_TUTOR_PRESENT` | 45% | 10% | hoàn 45% |
| `TUTOR_ABSENT` | 0% | 0% | hoàn 100% |

Nếu attendance thiếu/corrupt cho một agreement hợp lệ, Contract chọn fail-safe `TUTOR_ABSENT`, không mặc định payout Tutor.

## 6. Mốc 24 giờ và tự động giải ngân

1. Backend queue `PROPOSE`.
2. Event `SessionSettlementProposed` được xác nhận; DB thành `PROPOSED` và nhận deadline on-chain.
3. 24 giờ tính từ confirmed proposal.
4. Nếu vẫn `PROPOSED` khi hết hạn, Contract scheduler queue `FINALIZE`.
5. Chỉ `SessionSettled` confirmed mới đổi `SETTLED/REFUNDED`, ghi exact amounts/hash/time và phát notification.

Nếu service tắt qua deadline, không có blockchain execution tự thân. Khi mở lại:

- Learning startup scan bắt kịp session quá giờ;
- delivery worker gửi lại bản ghi chưa acknowledged;
- Contract scan sau 30 giây và mỗi 60 giây bắt proposal quá hạn;
- dispatcher/receipt watcher tiếp tục intent dở dang mỗi 5 giây.

Dispute `OPENING/OPEN/UNDER_REVIEW/RESOLUTION_PENDING` không được scheduler chọn để finalize.

## 7. Dispute flow

### Mở đơn

- Chỉ Student/Tutor thuộc agreement và proposal còn trong 24 giờ.
- V1 chỉ cho outcome `BOTH_PRESENT`.
- Reason text bắt buộc; file optional.
- Đơn tạo transaction `OPEN_DISPUTE`; khi confirmed, settlement thành `DISPUTED` và giữ tiền.

### Evidence

- Ảnh: JPEG, PNG, WebP, GIF.
- Video: MP4, WebM, QuickTime.
- Audio: MP3/M4A/WAV.
- Tài liệu: PDF, TXT, DOC/DOCX, XLS/XLSX.
- Tối đa 50 MB/file.
- Runtime hiện dùng S3; key tách `agreement/session/role`; DB lưu SHA-256 và metadata.

### Hiển thị và phản hồi

- Student chỉ xem Student-visible dispute của agreement mình.
- Tutor xem complaint do Student gửi và có thể nộp/cập nhật phản hồi trong 24 giờ từ `submittedAt`.
- Tutor-origin complaint và Tutor-private response/evidence không hiển thị cho Student.
- Assigned Staff xem lớp mình phụ trách; Admin xem toàn cục.

### Phân xử

- Nếu Tutor đã phản hồi: Staff/Admin có thể xử lý ngay.
- Nếu chưa phản hồi: phải chờ hết response window 24 giờ.
- Sau đó không có arbitration deadline; tiền giữ đến khi resolution confirmed.
- Approve → hoàn 100% Student.
- Reject → trả 85% Tutor, 15% Platform.

## 8. Runtime evidence

- Payout `BOTH_PRESENT` 0.6 USDC: 0.51 Tutor + 0.09 Platform, Sepolia tx `0xd835b8ae250b20141feb32d26eb081ca1a0d532c9c6780b9622812c91990dc2`.
- Refund `TUTOR_ABSENT` cho Tin học lớp 4 buổi 1: 0.6 Student, Sepolia tx `0xf608981a95f001b0cc5bd338995bd2cb54cc4addcf35b15957e06536005a3ec1`.
- Ngày 2026-09-14: mọi Learning session `COMPLETED` trong DB đều `settlement_dispatched=true`; không có actionable failed transaction.
- Test gần nhất: 12 Learning attendance/delivery tests và 14 Contract scheduler/restart transaction tests pass.

## 9. Trạng thái UI cần hiểu đúng

- `PROPOSE_PENDING`: đang queue/gửi proposal, chưa mở 24 giờ on-chain.
- `PROPOSED`: proposal confirmed, đang đếm 24 giờ.
- `DISPUTE_OPENING`: đang gửi giao dịch mở khiếu nại.
- `DISPUTED`: tiền đang giữ vì khiếu nại.
- `FINALIZE_PENDING`: đang gửi finalize, chưa được ghi là tiền đã về.
- `SETTLED`: payout confirmed.
- `REFUNDED`: refund confirmed.
- `FAILED_RETRYABLE`: cần worker hoặc Admin recovery tùy loại failure.
- `EXCLUDED_LEGACY`: audit-only, không được thao tác tiền.

## 10. Giới hạn và việc tiếp theo

- Muốn dispute outcome ngoài `BOTH_PRESENT` cần Solidity version/deployment mới.
- Cần production monitoring cho RPC, gas, event cursor, failed transaction và S3.
- Cần multi-RPC/HA design trước khi cam kết SLA cao.
- Notification đã có cho các mốc quan trọng nhưng chưa phải mọi hành động homework/session đều có persistent notification.
- Mobile chưa có UI session/attendance/dispute.
