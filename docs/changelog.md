
# Nhật Ký Thay Đổi

## 2026-06-29 17:35:07 +07:00

Các việc đã thực hiện hôm nay:

- Dựng bộ khung kiến trúc hướng dịch vụ cho đồ án `KLTN_Edu`.
- Tạo các backend service Spring Boot độc lập:
  - `backend/api-gateway`
  - `backend/auth-service`
  - `backend/learning-service`
  - `backend/contract-service`
  - `backend/notification-service`
- Tạo cấu trúc package chuẩn cho từng service:
  - `infrastructure/config`
  - `infrastructure/security`
  - `infrastructure/persistence`
  - `infrastructure/client`
  - `infrastructure/external`
  - `shared/exception`
  - `shared/response`
  - `shared/constants`
  - `shared/enums`
  - `shared/utils`
  - `modules/<module>/{controller,service,repository,entity,dto,mapper,validator}`
- Tạo `api-gateway` với `pom.xml`, Maven wrapper, main application class và `application.properties`.
- Đổi tên frontend:
  - `web` thành `frontend-web`
  - `mobile` thành `mobile-app`
- Tạo cấu trúc database:
  - `database/schema`
  - `database/migration`
  - `database/seed`
  - `database/diagrams`
- Tạo cấu trúc tài liệu:
  - `docs/ai-context`
  - `docs/architecture`
  - `docs/api`
- Tạo `docker`, `docker-compose.yml` và `README.md`.
- Phân bổ source NestJS cũ từ `backend/src` vào các thư mục `legacy-nestjs` theo service tương ứng.
- Ghi lại ánh xạ migration, quy tắc nghiệp vụ, ánh xạ database và quy ước API trong `docs/ai-context`.
- Việt hóa toàn bộ nội dung các file `.md` trong `docs/ai-context`.

Ghi chú:

- `legacy-nestjs` chỉ là source tham chiếu để rewrite sang Java Spring Boot.
- Không đưa file TypeScript vào package Java.
- `backend/dist` là output build cũ, có thể xóa nếu không cần tham chiếu.
