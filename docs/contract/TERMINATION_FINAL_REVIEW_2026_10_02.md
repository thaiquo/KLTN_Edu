# Rà soát bổ sung vận hành dừng/hủy lớp — 02/10/2026

Additional whole-system audit: the internal Notification send endpoint previously accepted unauthenticated POSTs with a caller supplied recipient id. Source now validates a scoped `notification-send` JWT and both Contract producers attach it. MockMvc and outbox tests cover rejected and accepted tokens. Account reviewer lookup's earlier HTTP 500 without token is fixed in source and tests, but the running Account process observed during audit had not loaded that fix. The last local port probe found 8080–8084 open, 8085 and 5173 closed. These process observations are time specific; they do not change source feature classifications.

## Phạm vi và quyền

| Vai trò | Phạm vi đã kiểm tra |
| --- | --- |
| Student | Yêu cầu chấm dứt hợp đồng cá nhân, ký ví; xem tiến độ và số tiền của chính mình. Không hủy toàn lớp. |
| Tutor | Đề xuất hủy cả lớp; nhận cảnh cáo, gửi giải trình, minh chứng và lịch bù. Phản hồi không tự khôi phục lớp. |
| Staff | Hồ sơ thuộc lớp được phân công; thẩm định và kiến nghị. Không quyết định hủy/khôi phục. |
| Admin | Dừng toàn lớp hoặc riêng hợp đồng, phê duyệt/từ chối, quyết định khẩn cấp. Hoàn tiền chờ quyết toán và xác nhận blockchain. |

Quy tắc deadline cảnh cáo dùng lịch buổi tiếp theo và thời gian tối thiểu để gia sư
phản hồi theo implementation hiện tại; hết hạn cho phép xử lý, không tự động kết luận
gia sư vi phạm và hoàn tiền. REQUESTED khác APPROVED, APPROVED khác COMPLETED.

## Lỗi phát hiện và sửa trong lần rà soát này

1. **Minh chứng và thao tác đồng thời:** `addEvidence` khóa hồ sơ trước khi kiểm tra
   trạng thái, quyền và hạn mức tệp. Tránh kiểm tra trạng thái cũ khi Admin quyết định
   hoặc hai lượt tải cùng diễn ra. Thêm kiểm thử thứ tự lock → count → save.
2. **HTTP xác thực nội bộ:** gọi API reviewers thiếu token thực tế trả 500 do
   GlobalExceptionHandler bắt ResponseStatusException vào nhánh lỗi chung. Đổi sang
   UnauthorizedException của Account; kiểm thử MockMvc có GlobalExceptionHandler
   xác nhận thiếu/sai token trả 401, không truy vấn danh sách người dùng.
3. **Thông báo lỗi bị mất:** tách lỗi tải danh sách khỏi lỗi thao tác, để polling không
   xóa mất lỗi gửi. Thêm vùng alert/status và nút đóng lỗi.
4. **Gửi minh chứng một phần:** cập nhật danh sách minh chứng từ phản hồi mỗi tệp thành
   công, giữ đúng các tệp chưa gửi; lỗi giải thích cách thử lại và nạp lại trạng thái.
5. **Phản hồi quyết định:** dùng trạng thái thực từ API thay thông báo thành công chung;
   người dùng phân biệt đang khôi phục, đang quyết toán và đã hoàn tất.
6. **Nhãn SYSTEM_REVIEW:** đề nghị xem xét không đồng nghĩa đã dừng lịch; sửa diễn đạt
   trạng thái dùng chung để không thông báo sai.

Các sửa này không thêm bảng/cột, không xóa lịch sử, không thay tài sản escrow hay
quyền quyết định cuối của Admin. Không phát giao dịch hoàn tiền để thử nghiệm.

## Bằng chứng kiểm chứng

- Contract: 54 kiểm thử thuộc Service, Processor, Signals, FlowIntegration và Outbox đạt.
- Frontend: 7 kiểm thử tiện ích đạt; TypeScript và production build đạt. Build vẫn có
  cảnh báo thư viện Web3/import và thời gian plugin.
- Account: chạy lại InternalNotificationRecipientsTest và GlobalExceptionHandlerTest;
  kết quả cuối ghi trong báo cáo trả người dùng và target/surefire-reports.
- HTTP ở lần kiểm tra trước: frontend localhost:5173 trả 200; Contract terminations
  không đăng nhập trả 401; Account reviewers thiếu token trả 500 ở bản trước sửa.
  Lần kiểm tra cổng sau cùng, 5173 đã đóng; kết quả 200 cũ không còn đại diện
  cho trạng thái tiến trình hiện tại.
- Build frontend xuất vào thư mục tạm; không thay dist đang được người dùng quản lý.

## Giới hạn cần phân biệt

Kiểm thử MockMvc xác nhận bản sửa Account, không chứng minh tiến trình Account đang chạy
đã nạp bản sửa. Cần restart/deploy bản mới để áp dụng thay đổi backend. Chưa chạy thao tác
trình duyệt end-to-end với bốn tài khoản; phiên này không có công cụ browser automation.
Kết quả kiểm thử không phải cam kết hệ thống không còn lỗi trong mọi tình huống.

Kiểm tra Maven: Learning 90 đạt, Account 140 đạt, Notification 41 đạt, Contract 200 đạt
và 7 Anvil integration tests skipped. Không ghi các test skipped thành passed.
