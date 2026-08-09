# Quy Ước API

## Phong Cách API Mục Tiêu

- Client bên ngoài gọi vào `api-gateway`.
- Gateway định tuyến request tới các Spring Boot service phía sau.
- Mỗi service sở hữu API và bảng database thuộc domain của mình.
- Validate request đặt trong DTO và package `validator` của từng module.
- Format response và exception chung đặt trong package `shared` của từng service.

## Route Cũ Cần Giữ Về Mặt Ý Nghĩa

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Learning

- `GET /users`
- `GET /users/:userId`
- `GET /users/:userId/profile`
- `POST /users/:userId/profile`
- Các route tutor application dưới `/users/me/tutor-applications`.
- Các route admin review dưới `/users/tutor-applications`.
- Các route certificate dưới `/certificates`.
- Các route catalog dưới `/catalog`.
- Các route post và match request dưới `/posts` và `/match-requests`.
- Các route classroom dưới `/classrooms`.
- Các route enrollment dưới `/enrollments`.
- Các route session và attendance dưới `/sessions` và `/attendances`.
- Các route assignment và submission dưới `/assignments` và `/submissions`.

### Contract

- Các route payment dưới `/payments`.
- Route contract cũ nằm dưới `/payments/contracts`; khi rewrite nên tách rõ theo module contract.
- Các route wallet dưới `/wallets`.

### Notification

- Các route notification dưới `/notifications` hoặc user notification route.
- Các route chat dưới `/chat/conversations` và `/chat/messages`.
- Realtime socket event cần thiết kế lại cho notification-service bằng Spring Boot.
