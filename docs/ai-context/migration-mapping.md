# Ánh Xạ Migration

File này ghi lại cách source hiện có đã được phân bổ vào kiến trúc hướng dịch vụ mới.

## Frontend

- `web` đã được đổi tên thành `frontend-web`.
- `mobile` đã được đổi tên thành `mobile-app`.

## Backend NestJS Cũ

Monolith NestJS trước đây trong `backend/src` đã được phân bổ lại dưới dạng source tham chiếu:

| Đường dẫn cũ | Đường dẫn mới | Package rewrite mục tiêu |
| --- | --- | --- |
| `backend/src/modules/auth` | `backend/auth-service/legacy-nestjs/modules/auth` | `auth-service/modules/auth` |
| `backend/src/modules/user` | `backend/learning-service/legacy-nestjs/modules/user` | `learning-service/modules/tutor`, `student` |
| `backend/src/modules/catalog` | `backend/learning-service/legacy-nestjs/modules/catalog` | `learning-service/modules/subject` |
| `backend/src/modules/post` | `backend/learning-service/legacy-nestjs/modules/post` | `learning-service/modules/learning_request`, `matching` |
| `backend/src/modules/classroom` | `backend/learning-service/legacy-nestjs/modules/classroom` | `learning-service/modules/classroom` |
| `backend/src/modules/session` | `backend/learning-service/legacy-nestjs/modules/session` | `learning-service/modules/session` |
| `backend/src/modules/assignment` | `backend/learning-service/legacy-nestjs/modules/assignment` | `learning-service/modules/assignment` |
| `backend/src/modules/payment` | `backend/contract-service/legacy-nestjs/modules/payment` | `contract-service/modules/payment`, `contract` |
| `backend/src/modules/wallet` | `backend/contract-service/legacy-nestjs/modules/wallet` | `contract-service/modules/wallet` |
| `backend/src/modules/engagement` | `backend/notification-service/legacy-nestjs/modules/engagement` | `notification-service/modules/notification`; review/document cần chốt ownership |
| `backend/src/modules/chat` | `backend/notification-service/legacy-nestjs/modules/chat` | `notification-service/modules/chat` |
| `backend/src/modules/socket` | `backend/notification-service/legacy-nestjs/modules/socket` | `notification-service/infrastructure/external` hoặc realtime adapter của `modules/chat` |
| `backend/src/config` | `backend/api-gateway/legacy-nestjs/config` | `infrastructure/config` của từng service |
| `backend/src/database` | `backend/api-gateway/legacy-nestjs/database` | `infrastructure/persistence` của từng service |
| `backend/src/common` | `backend/api-gateway/legacy-nestjs/common` | `shared` hoặc `infrastructure/external` |
| `backend/src/scripts` | `backend/api-gateway/legacy-nestjs/scripts` | `database/seed` sau khi rewrite sang MySQL |
| `backend/src/main.ts` | `backend/api-gateway/legacy-nestjs/root/main.ts` | bootstrap Spring Boot của từng service |
| `backend/src/app.module.ts` | `backend/api-gateway/legacy-nestjs/root/app.module.ts` | wiring dependency của từng service |
| `backend/src/app.controller.ts` | `backend/api-gateway/legacy-nestjs/root/app.controller.ts` | health/root endpoint nếu cần |
| `backend/package.json` | `backend/api-gateway/legacy-nestjs/root/package.json` | chỉ tham chiếu dependency cũ |
| `backend/package-lock.json` | `backend/api-gateway/legacy-nestjs/root/package-lock.json` | chỉ tham chiếu dependency cũ |
| `backend/tsconfig.json` | `backend/api-gateway/legacy-nestjs/root/tsconfig.json` | chỉ tham chiếu cấu hình build cũ |
| `backend/TODO.md` | `backend/api-gateway/legacy-nestjs/root/TODO.md` | tài liệu kế hoạch cũ |

## Output Được Sinh Ra

`backend/dist` là output JavaScript được build từ backend TypeScript cũ. Không xem đây là source chính cho quá trình migration Spring Boot.

## Quy Tắc Viết Lại

Di chuyển hành vi nghiệp vụ, không di chuyển framework code. Controller, service, DTO và schema trong `legacy-nestjs` phải được viết lại thành class Java Spring Boot khi triển khai module tương ứng.
