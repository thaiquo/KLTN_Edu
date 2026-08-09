# Quy Tắc Nghiệp Vụ

Các quy tắc dưới đây được suy ra từ source NestJS cũ đã migration. Khi rewrite sang Java cần kiểm tra lại với yêu cầu thực tế của đồ án.

## Dịch Vụ Xác Thực

- Người dùng đăng ký bằng họ tên, email, số điện thoại, mật khẩu và role.
- Role cũ đang hỗ trợ: `student`, `tutor`, `admin`.
- Đăng nhập dùng email và mật khẩu.
- JWT chứa user id, email và role.

## Dịch Vụ Học Tập

- Quy trình trở thành gia sư được xử lý thông qua tutor application.
- Tutor application có các trạng thái: `pending`, `approved`, `rejected`, `withdrawn`.
- Minh chứng theo môn học của gia sư có trạng thái duyệt: `pending`, `approved`, `rejected`.
- Hình thức tính giá của gia sư gồm: `per_hour`, `per_session`, `per_30_days`, `per_course`.
- Yêu cầu học và ghép nối trong source cũ được biểu diễn bằng `post` và `match_request`.
- Lớp học có trạng thái: `draft`, `active`, `completed`, `cancelled`.
- Enrollment có trạng thái: `active`, `pending`, `cancelled`, `completed`.
- Buổi học có trạng thái: `scheduled`, `completed`.
- Assignment có submission.
- Certificate có trạng thái: `pending`, `approved`, `rejected`, `expired`, `revoked`, `needs_update`.

## Dịch Vụ Hợp Đồng

- Contract có trạng thái: `draft`, `active`, `released`, `cancelled`.
- Payment có trạng thái: `pending`, `paid`, `failed`, `refunded`.
- Wallet thuộc về user và được dùng trong luồng thanh toán/hợp đồng.

## Dịch Vụ Thông Báo

- Notification thuộc về một user, gồm type, title, content và trạng thái đã đọc/chưa đọc.
- Chat hỗ trợ conversation và message.
- Loại message cũ gồm: `text`, `image`, `file`, `system`.
- Source cũ có socket gateway để phát sự kiện realtime.
