# Rà soát hủy lớp và thông báo — 02/10/2026

## Phạm vi và kết quả

Rà soát Contract, phần hold/release của Learning, tra người nhận tại Account,
Bell và giao diện hủy lớp. Đây không phải xác nhận toàn bộ EduConnect hoàn thiện 100%.

- Chỉ Admin quyết định duyệt, hủy khẩn cấp, từ chối/khôi phục lớp. Staff chỉ kiến nghị trong phạm vi được giao.
- Sửa frontend chặn nhầm FORCE_APPROVE khi còn dispute; tiền vẫn chờ settlement đã xác nhận.
- Giữ hồ sơ HOLD_PENDING khi Learning tạm ngắt lúc tạo lệnh khẩn cấp; UI báo cần Admin duyệt tiếp sau đồng bộ.
- Giữ trạng thái thu gọn thẻ khi polling, sửa ranh giới đúng 6 giờ trong phép tính deadline.
- Sửa bộ lọc lớp dùng sai tên trường, giữ ngữ cảnh đường dẫn Bell khi Portal chuyển trang,
  phân biệt agreement UUID và classroom ID; Student mở ví, các vai trò còn lại mở hồ sơ hủy.
- Sửa hạn nộp bài ở màn hình chấm bài dùng assignmentDueAt theo API.
- Phần tóm tắt Student thể hiện đúng nguồn Admin/hệ thống/Gia sư, không lộ minh chứng riêng.

## Thông báo

V18 thêm termination_notification_outbox để lưu ý định gửi cùng transaction nghiệp vụ.
Worker chốt danh sách người nhận trước khi gửi, giữ eventId khi retry; Notification Service
chống trùng theo eventId/recipientUserId. Không gửi thông báo từ transaction đã rollback.

Account sở hữu ánh xạ người nhận. GET /api/internal/notification-reviewers yêu cầu
X-Service-Token ký JWT, subject contract-service, serviceScope notification-recipients,
có expiration. Trả về Admin đang ACTIVE và Staff đang ACTIVE khớp reviewerEmail;
không truy cập chéo bảng users từ Contract. Cấu hình ACCOUNT_SERVICE_URL mặc định localhost:8081.

Các bước có thông báo: tiếp nhận hồ sơ, hold/release thành công sau retry, phản hồi,
minh chứng mới cho reviewer, kiến nghị/quyết định, hoàn tất từng hợp đồng. Cảnh cáo
vắng học hết hạn mà chưa phản hồi tạo một sự kiện TERMINATION_DEADLINE_EXPIRED duy nhất.
Nội dung không kèm file hay chi tiết giải trình riêng tư. Bell dùng Notification Service
và WebSocket sẵn có; giao diện hồ sơ vẫn đối chiếu trạng thái qua REST.

## Database local

### Kiểm tra bổ sung sau báo cáo và ảnh giao diện (02/10)

Rà soát tiếp các vai trò: API refunds cho học viên hiển thị cả hồ sơ hủy lớp đang chờ
duyệt bằng preview WAITING_APPROVAL của đúng hợp đồng; không ghi thêm termination_item,
không lộ audit/minh chứng của gia sư hoặc tiền của học viên khác. Hồ sơ cá nhân chưa có
item được tìm theo anchorAgreementId. Gia sư có mẫu giải trình kèm lịch bù; gửi giải trình
không tự động khôi phục lớp. Upload nhiều tệp giữ lại đúng tệp chưa gửi khi lỗi giữa chừng.
Nút quyết định Admin và thông báo phân biệt phạm vi toàn lớp/hợp đồng cá nhân. Tổng
settledSessions của nhiều hợp đồng được ghi là lượt học, không gọi là số buổi của lớp.

- Lớp #3: CANCELLED, cutoff 5; có 5 buổi COMPLETED và 1 buổi CANCELLED. Không được tính thành 6 buổi hoàn thành.
- Lớp #5 đã chuyển từ LOCKED sang CANCELLED trong thời gian rà soát; lần truy vấn cuối xác nhận hồ sơ AUTO_TUTOR_ABSENCE COMPLETED, cutoff 3.
- Outbox ở lần truy vấn cuối: 14 delivered, 0 pending. Đây là xác nhận giao từ outbox, chưa phải kiểm thử chuông thông báo trên trình duyệt của từng người dùng.
- Không thêm bảng/cột cho sửa lỗi giao diện: `attendanceStopped` được tính từ trạng thái lớp và learning_termination_stop của đúng học viên.
- API lịch và thông tin đăng ký dùng mốc dừng riêng; các học viên khác không bị khóa theo hồ sơ cá nhân.
- Lịch trực tiếp dùng buổi thực tế; không suy ra LIVE từ lịch tuần khi buổi đã hủy/hoàn tất. Tách số buổi hoàn thành, hủy, đang dừng tham gia.
- Chọn hồ sơ theo đúng agreement, bỏ hồ sơ REJECTED khỏi nhãn đang xử lý; phân biệt hủy cả lớp và chấm dứt hợp đồng cá nhân.
- Sửa thiếu import AlertCircle của AdminClassManagement. Production build không thay thế kiểm tra TypeScript.
- Chạy lại toàn bộ Maven: Learning 90 đạt; Account 139 đạt; Contract 198 đạt, 7 skipped (205 tổng). Không kết luận 205/205 đã chạy thành công.
- Frontend: 6 kiểm thử tiện ích đạt; TypeScript đạt. Chưa kiểm thử thao tác trình duyệt đầy đủ bốn vai trò trong lần rà soát này.

### Ảnh chụp kiểm tra trước đó

Truy vấn chỉ đọc xác nhận Contract Flyway đến V18 thành công; không có termination_item
hoặc termination_evidence mồ côi, không có hồ sơ mở chồng phạm vi. Outbox có 0 bản ghi
tại thời điểm kiểm tra, nên chưa có bằng chứng giao thông báo thật giữa các service.

Phát hiện hồ sơ tự động cũ mang origin PARTY_REQUEST. V19 phân loại theo detection_key;
hồ sơ vắng học REQUESTED/RECOMMENDED chuyển HOLD_PENDING để worker thiết lập hold và
deadline mới. Hồ sơ đã đóng giữ nguyên trạng thái và audit. Cần chạy Flyway V19 với bản mới.

Không xóa bảng hoặc lịch sử: case là hồ sơ, item là kết quả từng agreement, evidence
là metadata tài liệu, outbox là ý định giao thông báo. Đây là bốn trách nhiệm khác nhau.

## Giới hạn kiểm chứng

Kiểm thử tự động kiểm tra quyền, migration, rollback, retry HTTP và dedupe deadline.
Production build chạy được ngoài sandbox; thư viện Web3 còn cảnh báo annotation/import.
Không dùng kết quả build để khẳng định đã kiểm thử trình duyệt cho mọi vai trò hay đã
thực hiện hoàn tiền Sepolia mới trong lần rà soát này.
