# Kế hoạch chấm dứt hợp đồng trên Escrow V1

Ngày: 2026-09-21. Phạm vi: Contract Service, Learning Service, Web.
Giữ nguyên Solidity, ABI, địa chỉ deployment và tỷ lệ quyết toán hiện tại.

## Quy tắc

- Student/Tutor gửi yêu cầu riêng cho agreement thuộc quyền. Tutor/Staff/Admin có thể đề nghị chấm dứt cả lớp; Student không được hủy tiền của người khác.
- Staff phụ trách xác minh và đề xuất; Admin quyết định cuối cùng. Lý do, giải trình và quyết định lưu bền.
- Ba buổi vắng liên tiếp là dấu hiệu cần xem xét, không phải bằng chứng tự động hủy. Báo cáo trùng không được cộng thành nhiều vi phạm.
- Chỉ dừng các buổi tương lai sau khi Admin duyệt. Buổi đã bắt đầu trước thời điểm dừng vẫn phải quyết toán, kể cả chưa được Learning gửi sang Contract.
- Hồ sơ chấm dứt không tự đóng băng tiền của buổi đang khiếu nại. Giữ nguyên cửa sổ 24h và quy trình dispute V1.
- Cancel chỉ chạy khi mọi buổi đã bắt đầu đã có settlement kết thúc; không bỏ qua PREPARING, proposal đang gửi, dispute hoặc finalize đang gửi.
- Hoàn remainingAmount về Student bằng V1; không thu phí chấm dứt, không lấy lại khoản đã giải ngân.
- Agreement CANCELLED chỉ sau event xác nhận. Lỗi mạng không được coi là hoàn tiền thành công.
- Cả lớp là nhiều giao dịch độc lập, tiến độ và lỗi theo từng agreement, chạy lại không gửi hoàn tiền lần hai.
- CREATED/WAITING_PAYMENT phải chờ payment deadline mới expire on-chain; funding đến trong lúc xử lý vẫn phải được tiếp nhận và hoàn đúng.
- Không dùng expireEnrollment để chấm dứt: không đổi nhầm sang EXPIRED hoặc mở tuyển sinh lại khi đang đóng lớp.
- Hồ sơ, lớp, attendance, hợp đồng và giao dịch cũ được giữ để tra cứu.

## Tasks theo thứ tự

- [x] T01: Đọc baseline, audit cancel/settlement, quyền và trạng thái Learning.
- [x] T02: Schema hồ sơ, item theo agreement, audit; API gửi/giải trình/Staff đề xuất/Admin duyệt; chống trùng và phân quyền.
- [x] T03: Learning lưu mốc dừng, chặn tham gia/sinh buổi tương lai, trả danh sách buổi phải quyết toán; API nội bộ xác thực.
- [x] T04: Worker tiếp tục sau restart: đồng bộ Learning, chờ settlement, queue V1 cancel/expire, theo dõi confirmed event, đóng enrollment/lớp.
- [x] T05: Web gửi yêu cầu riêng/cả lớp, giải trình, duyệt và tiến độ từng agreement; xử lý loading/error/refresh.
- [x] T06: Kiểm thử quyền, duplicate/retry, buổi đã bắt đầu chưa giao, waiting-payment, hoàn tiền confirmed, hủy riêng không ảnh hưởng lớp (20 Contract tests + 6 Learning tests passed).
- [x] T07: Cập nhật baseline và hướng dẫn kiểm thử/chạy; build backend/Web và báo cáo giới hạn đã kiểm chứng.

## Điều kiện nghiệm thu

1. Student A không đọc hoặc thay đổi item của B; Staff ngoài lớp bị từ chối; chỉ Admin duyệt.
2. Yêu cầu chưa duyệt không làm thay đổi việc học hoặc tiền.
3. Buổi đang học khi duyệt vẫn được chốt và chờ đúng quy trình; buổi tương lai không tạo nghĩa vụ trả tiền mới cho agreement đã dừng.
4. Worker chờ mọi settlement cần thiết và không được bỏ qua giao dịch pending/failed chưa xử lý.
5. Hủy A giữ nguyên học tập/settlement B; hủy cả lớp có thể tiến triển từng item độc lập.
6. Restart hoặc bấm lại không tạo giao dịch hoàn trùng; lỗi Learning/RPC được hiển thị, không ghi nhận hoàn tiền giả.
7. Số tiền xác nhận dựa trên event blockchain, không suy đoán từ số buổi UI.

## Kiểm thử vận hành

Không tự gửi giao dịch lên Sepolia trong quá trình triển khai mã. Dùng unit/integration test và build trước; chạy kịch bản có ví thử nghiệm riêng để nghiệm thu on-chain.
Các ngưỡng tự phát hiện vi phạm và upload evidence mở rộng phải ghi đúng trạng thái nếu chưa triển khai, không đánh dấu hoàn thành chỉ vì có UI.
