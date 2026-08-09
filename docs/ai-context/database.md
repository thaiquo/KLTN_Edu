# Cơ Sở Dữ Liệu

## Mục Tiêu

Cơ sở dữ liệu mục tiêu của hệ thống là MySQL.

Tài nguyên database được đặt trong:

- `database/schema`
- `database/migration`
- `database/seed`
- `database/diagrams`

## Source Cũ

Backend cũ dùng MongoDB thông qua NestJS Mongoose schema. Các schema này đã được chuyển vào thư mục `legacy-nestjs` của từng service để làm căn cứ thiết kế lại bảng MySQL.

## Ánh Xạ Collection Cũ Sang Module Mới

- `users`: `auth-service/modules/auth` cho định danh; dữ liệu profile riêng sẽ thuộc `learning-service/modules/student` hoặc `learning-service/modules/tutor`.
- `user_roles`: `auth-service/modules/auth`.
- `profiles`: `learning-service/modules/student` hoặc model profile dùng chung khi rewrite.
- `tutor_profiles`: `learning-service/modules/tutor`.
- `tutor_applications`: `learning-service/modules/tutor`.
- `schedules`: `learning-service/modules/tutor`.
- `certificates`: `learning-service/modules/tutor`.
- `subjects`: `learning-service/modules/subject`.
- `roles`: cần chốt lại khi rewrite; có thể là auth role hoặc dữ liệu catalog seed.
- `levels`: `learning-service/modules/subject`.
- `posts`: `learning-service/modules/learning_request`.
- `match_requests`: `learning-service/modules/matching`.
- `classrooms`: `learning-service/modules/classroom`.
- `enrollments`: `learning-service/modules/classroom`.
- `sessions`: `learning-service/modules/session`.
- `attendances`: `learning-service/modules/session`.
- `assignments`: `learning-service/modules/assignment`.
- `submissions`: `learning-service/modules/assignment`.
- `contracts`: `contract-service/modules/contract`.
- `payments`: `contract-service/modules/payment`.
- `wallets`: `contract-service/modules/wallet`.
- `notifications`: `notification-service/modules/notification`.
- `conversations`: `notification-service/modules/chat`.
- `messages`: `notification-service/modules/chat`.
- `reviews`: cần chốt ownership; nhiều khả năng thuộc feedback của classroom trong learning-service.
- `documents`: cần chốt ownership; nhiều khả năng thuộc tài liệu lớp học trong learning-service.

## Quy Tắc Migration Cơ Sở Dữ Liệu

Không bê nguyên cấu trúc document MongoDB sang MySQL. Các embedded document và array cần được tách thành bảng quan hệ khi cần query độc lập, ràng buộc dữ liệu hoặc mở rộng nghiệp vụ.
