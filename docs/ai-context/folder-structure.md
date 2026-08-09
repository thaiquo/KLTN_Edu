# Cấu Trúc Thư Mục

## Root

- `backend`: chứa các Spring Boot service và source NestJS cũ đã phân bổ để tham chiếu migration.
- `frontend-web`: project frontend web, được đổi tên từ `web`.
- `mobile-app`: project mobile, được đổi tên từ `mobile`.
- `database`: chứa schema, migration, seed và diagram cho MySQL.
- `docs`: chứa tài liệu AI context, kiến trúc và API.
- `docker`: chứa tài nguyên liên quan Docker.
- `docker-compose.yml`: cấu hình chạy local bằng Docker Compose.

## Cấu Trúc Chung Của Mỗi Dịch Vụ Spring Boot

Mỗi service Java dùng cấu trúc package sau:

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
- `modules/<module>/controller`
- `modules/<module>/service`
- `modules/<module>/repository`
- `modules/<module>/entity`
- `modules/<module>/dto`
- `modules/<module>/mapper`
- `modules/<module>/validator`

## Ánh Xạ Source NestJS Cũ

### Cổng API

- `backend/api-gateway/legacy-nestjs/root`: file bootstrap và file project của NestJS cũ.
- `backend/api-gateway/legacy-nestjs/config`: cấu hình môi trường cũ.
- `backend/api-gateway/legacy-nestjs/database`: module MongoDB/Mongoose cũ.
- `backend/api-gateway/legacy-nestjs/common`: common module và storage service cũ.
- `backend/api-gateway/legacy-nestjs/scripts`: script seed dữ liệu cũ.

### Dịch Vụ Xác Thực

- `backend/auth-service/legacy-nestjs/modules/auth`: controller, service, DTO, JWT guard, JWT strategy và schema auth user cũ.

### Dịch Vụ Học Tập

- `backend/learning-service/legacy-nestjs/modules/user`: logic user, profile, tutor profile, tutor application, schedule và certificate cũ.
- `backend/learning-service/legacy-nestjs/modules/catalog`: logic subject, role và level cũ.
- `backend/learning-service/legacy-nestjs/modules/post`: logic post và match request cũ. Khi rewrite sẽ tách thành `learning_request` và `matching`.
- `backend/learning-service/legacy-nestjs/modules/classroom`: logic classroom và enrollment cũ.
- `backend/learning-service/legacy-nestjs/modules/session`: logic session và attendance cũ.
- `backend/learning-service/legacy-nestjs/modules/assignment`: logic assignment và submission cũ.

### Dịch Vụ Hợp Đồng

- `backend/contract-service/legacy-nestjs/modules/payment`: logic payment và contract cũ.
- `backend/contract-service/legacy-nestjs/modules/wallet`: logic wallet cũ.

### Dịch Vụ Thông Báo

- `backend/notification-service/legacy-nestjs/modules/engagement`: logic notification, review và document cũ. Notification sẽ rewrite vào module `notification`; review/document cần chốt lại ownership khi rewrite.
- `backend/notification-service/legacy-nestjs/modules/chat`: logic conversation và message cũ.
- `backend/notification-service/legacy-nestjs/modules/socket`: socket gateway và socket service cũ.
