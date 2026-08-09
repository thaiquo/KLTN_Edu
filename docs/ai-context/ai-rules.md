# Quy Tắc Cho AI Khi Làm Việc Với Dự Án

- Không sinh code nghiệp vụ nếu chưa được yêu cầu rõ ràng.
- Giữ mỗi service độc lập.
- Đặt code domain vào đúng package module tương ứng.
- Ưu tiên thiết kế theo MySQL/JPA cho persistence backend.
- Giữ `frontend-web` và `mobile-app` là hai project riêng.
- Xem các thư mục `legacy-nestjs` là tài liệu tham chiếu migration, không phải code Java.
- Không import hoặc copy file TypeScript legacy vào package Java.
- Khi rewrite một module, đọc thư mục `legacy-nestjs` tương ứng trước.
- Giữ lại hành vi nghiệp vụ cũ khi phù hợp, nhưng chuyển persistence từ MongoDB/Mongoose sang MySQL/JPA.
- Cross-service call đặt trong `infrastructure/client`.
- Provider bên ngoài như storage, email, realtime adapter đặt trong `infrastructure/external`.
