# Hợp đồng, thanh toán và ký quỹ

Tài liệu này dùng cho câu hỏi của Guest về hợp đồng điện tử, thanh toán và ký quỹ trong EduConnect.

## Hợp đồng điện tử trong EduConnect là gì?

Hợp đồng điện tử là thỏa thuận giữa Student và Tutor cho một lớp hoặc hoạt động học cụ thể. Hợp đồng ghi nhận các thông tin quan trọng tại thời điểm lập, như các bên tham gia, lớp học, lịch học, học phí, ví thanh toán và các quy tắc quyết toán/khiếu nại.

Sau khi hợp đồng được ký, các điều khoản đã chốt không được tự ý sửa ngầm. Nếu cần thay đổi điều khoản, hệ thống cần một luồng xử lý có chủ đích.

## Khi nào hợp đồng được tạo?

Hợp đồng được tạo khi Student và Tutor đã đi đến bước thỏa thuận phù hợp trong luồng tham gia lớp. Tutor chấp nhận yêu cầu học là một bước trước đó; hợp đồng và thanh toán là phần giúp lớp/học viên chính thức đi vào trạng thái hoạt động.

## Ai ký hợp đồng?

Student và Tutor cùng tham gia ký hợp đồng. Tài liệu hiện tại mô tả việc ký dùng ví đã gắn với hợp đồng. Chữ ký xác nhận danh tính và nội dung hợp đồng trong luồng của EduConnect.

## Khi nào hợp đồng có hiệu lực?

Hợp đồng không chỉ dựa vào việc bấm thanh toán trên trình duyệt. Theo quy tắc hiện tại, hợp đồng chỉ được xem là hoạt động sau khi hệ thống xác nhận giao dịch ký quỹ thành công.

Nói ngắn gọn: Student cần ký quỹ đúng quy trình, và hệ thống phải xác nhận khoản nạp trước khi hợp đồng và lượt tham gia lớp chuyển sang trạng thái hoạt động.

## Ký quỹ là gì?

Ký quỹ là việc Student nạp khoản tiền học vào cơ chế giữ tiền của EduConnect. Khoản tiền này được giữ để phục vụ quyết toán theo từng buổi học.

EduConnect hiện dùng USDC test trên Sepolia cho môi trường hiện tại. Sepolia ETH chỉ dùng làm phí gas, không phải tài sản học phí ký quỹ.

## Tiền được quyết toán như thế nào?

Sau mỗi buổi học, Student và Tutor tự điểm danh. Khi buổi học kết thúc, hệ thống xác định kết quả điểm danh và xử lý quyết toán theo từng Student/hợp đồng.

Quy tắc hiện tại:

- Tutor và Student đều có mặt: 85% trả Tutor, 15% là phần nền tảng.
- Tutor có mặt, Student vắng: 45% trả Tutor, 10% là phần nền tảng, 45% hoàn Student.
- Tutor vắng: hoàn 100% cho Student.

Tỷ lệ này áp dụng theo từng buổi học và từng hợp đồng của Student, không tự động khóa hay hoàn tiền cho cả lớp chỉ vì một Student có vấn đề.

## Khi nào tiền được hoàn?

Tiền có thể được hoàn theo các trường hợp đã được hệ thống hỗ trợ, ví dụ Tutor vắng theo kết quả điểm danh, khiếu nại được chấp thuận, hoặc phần ký quỹ chưa dùng trong luồng chấm dứt/hủy lớp được duyệt.

Không nên hiểu mọi khiếu nại đều chắc chắn được hoàn tiền. Kết quả còn phụ thuộc dữ liệu điểm danh, bằng chứng, quy trình xử lý và xác nhận giao dịch.

## Hủy hợp đồng hoặc hủy lớp hoạt động ở mức nào?

Khi hợp đồng đã hoạt động, Student có thể gửi yêu cầu chấm dứt hợp đồng của chính mình trong luồng được hỗ trợ. Tutor có thể đề xuất dừng giảng dạy và hủy toàn bộ lớp nếu có lý do phù hợp.

Yêu cầu này không tự động hoàn tiền ngay. Hệ thống cần giữ trạng thái, chờ xử lý các buổi đã diễn ra, khiếu nại liên quan nếu có, rồi mới hoàn phần ký quỹ chưa dùng khi đủ điều kiện.

## Có thể chuyển USDC trực tiếp vào địa chỉ giữ tiền không?

Không. Student phải thanh toán theo đúng luồng của EduConnect. Chuyển USDC trực tiếp vào địa chỉ giữ tiền không được xem là khoản ký quỹ hợp lệ cho hợp đồng và không kích hoạt hợp đồng.

<!-- Source references:
- docs/BLOCKCHAIN.md
- docs/BUSINESS_RULES.md
- docs/IMPLEMENTATION_STATUS.md
- docs/contract/thong_tin.md
- docs/API.md
-->
