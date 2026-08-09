# Tổng Quan Dự Án

`KLTN_Edu` là đồ án tốt nghiệp đang được tái cấu trúc từ backend nguyên khối NestJS sang kiến trúc hướng dịch vụ.

## Kiến Trúc Mục Tiêu

- Backend: các dịch vụ Java Spring Boot độc lập.
- Cơ sở dữ liệu: MySQL.
- Triển khai: Docker Compose.
- Client: web frontend và mobile app là hai project riêng.
- Phong cách backend: mỗi service là một Spring Boot project riêng, có `pom.xml`, cấu trúc package và cấu hình độc lập.

## Các Dịch Vụ Backend

-- `backend/api-gateway`: cổng vào API, định tuyến request từ frontend tới các dịch vụ phía sau.
- `backend/auth-service`: xử lý đăng ký, đăng nhập, JWT và định danh người dùng.
- `backend/learning-service`: xử lý gia sư, học viên, môn học, yêu cầu học, ghép nối, lớp học, buổi học và bài tập.
- `backend/contract-service`: xử lý hợp đồng, thanh toán và ví.
- `backend/notification-service`: xử lý thông báo, email, chat và realtime communication.

## Source Cũ

Backend cũ là một monolith NestJS/TypeScript nằm trong `backend/src`. Source này đã được phân bổ lại vào các thư mục `legacy-nestjs` trong service gần đúng nhất để làm tài liệu tham chiếu khi viết lại bằng Java Spring Boot.

Không biên dịch hoặc xem `legacy-nestjs` là code Spring Boot. Thư mục này chỉ dùng để đọc logic cũ, mapping nghiệp vụ và rewrite sang Java sau này.
