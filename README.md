# KLTN_Edu - Tutor Student Platform

KLTN_Edu là hệ thống kết nối Gia sư và Học viên. Project đang được phát triển theo hướng service-based architecture, trong đó `account-service` là service trung tâm cho tài khoản, xác thực và hồ sơ cá nhân.

## Chức năng hiện có

### Account Service

`backend/account-service` hiện phụ trách:

- Đăng ký tài khoản.
- Xác minh email bằng OTP.
- Gửi lại OTP xác minh email.
- Đăng nhập bằng email/password.
- JWT authentication qua HttpOnly cookie.
- Logout.
- Quên mật khẩu.
- Đặt lại mật khẩu bằng OTP.
- Hồ sơ tài khoản hiện tại.
- Cập nhật hồ sơ cá nhân.
- Đổi mật khẩu khi đã đăng nhập.
- Upload avatar qua backend/S3.
- Role cơ bản: `STUDENT`, `TUTOR`, `STAFF`, `ADMIN`.

### Frontend Web

`frontend-web` hiện có:

- Home page.
- Login/Register.
- Verify Email OTP.
- Forgot/Reset Password.
- Current User Profile.
- Edit Profile.
- Change Password.
- Auth state dựa trên `GET /api/users/me`.
- Cookie/CSRF flow đúng với backend.

## Cấu trúc chính

```text
KLTN_Edu/
├── .env
├── .env.example
├── docker-compose.yml
├── backend/
│   └── account-service/
│       ├── pom.xml
│       ├── mvnw
│       ├── mvnw.cmd
│       ├── run-local.sh
│       └── src/
├── frontend-web/
└── mobile-app/
```

## Yêu cầu môi trường

- Java JDK 21.
- Docker Desktop.
- Git Bash trên Windows.
- Node.js phù hợp với Vite.
- Maven Wrapper đã có trong `backend/account-service`.

Kiểm tra nhanh:

```bash
java -version
docker --version
node -v
npm -v
```

## Cấu hình môi trường

Project dùng root `.env` để chứa cấu hình local và secret. File này đã được Git ignore.

Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

Sau đó điền các giá trị cần thiết trong `.env`.

Các biến quan trọng:

```env
DB_URL=jdbc:postgresql://localhost:5432/kltn_db
DB_USERNAME=postgres
DB_PASSWORD=

POSTGRES_DB=kltn_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=

JWT_SECRET=
JWT_EXPIRATION=86400000

FRONTEND_URL=http://localhost:5173

MAIL_USERNAME=
MAIL_PASSWORD=

STORAGE_PROVIDER=s3
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_PRESIGNED_URL_DURATION=10m

OTP_LOG_TO_CONSOLE=false
```

Lưu ý:

- Không commit `.env`.
- Không đưa secret thật vào `.env.example`.
- `JWT_SECRET`, `DB_USERNAME`, `DB_PASSWORD` là bắt buộc khi chạy `account-service`.
- Nếu muốn test OTP nhanh ở local, có thể đặt `OTP_LOG_TO_CONSOLE=true` trong `.env`. Không bật giá trị này cho production.

## Chạy database PostgreSQL

Từ root project:

```bash
docker compose up -d postgres
```

Kiểm tra container:

```bash
docker ps
```

PostgreSQL sẽ mở port:

```text
localhost:5432
```

Database mặc định:

```text
kltn_db
```

## Chạy account-service

Nên chạy bằng Git Bash.

Từ root project:

```bash
cd backend/account-service
./run-local.sh
```
./mvnw spring-boot:run
Script này sẽ:

- Tìm root `.env`.
- Load environment variables.
- Kiểm tra các biến bắt buộc trong `application.properties`.
- Chạy Maven Wrapper.
- Start Spring Boot.

Nếu port `8080` đang bận, chạy bằng port khác:

```bash
./run-local.sh -Dspring-boot.run.arguments=--server.port=18080
```

Khi chạy thành công, log sẽ có dạng:

```text
Started AccountServiceApplication
```

Backend mặc định:

```text
http://localhost:8080
```

## Chạy frontend-web

Mở terminal khác:

```bash
cd frontend-web
npm install
npm run dev
```

Frontend mặc định:

```text
http://localhost:5173
```

Nếu backend chạy port khác, cấu hình frontend bằng biến môi trường Vite phù hợp, ví dụ:

```env
VITE_API_URL=http://localhost:18080
```

## Luồng chạy local đề xuất

1. Cấu hình `.env`.
2. Start PostgreSQL:

```bash
docker compose up -d postgres
```

3. Start account-service:

```bash
cd backend/account-service
./run-local.sh
```

4. Start frontend:

```bash
cd frontend-web
npm run dev
```

5. Mở:

```text
http://localhost:5173
```

## API chính của account-service

Auth:

```text
POST /api/auth/register
POST /api/auth/verify-email
POST /api/auth/resend-verification-otp
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/csrf
```

Current user:

```text
GET  /api/users/me
PUT  /api/users/me
POST /api/users/me/avatar
PUT  /api/users/me/password
```

## Kiểm thử backend

Trong `backend/account-service`:

```bash
./mvnw.cmd clean test
```

Hoặc trong Git Bash:

```bash
./mvnw clean test
```

## Build frontend

Trong `frontend-web`:

```bash
npm run build
```

Hiện tại Vite có thể cảnh báo chunk `DashboardPage` lớn hơn 500kB. Đây là warning hiệu năng cho phần dashboard/deferred, không phải lỗi build.

## Ghi chú phát triển

- Backend không lưu JWT trong response body để frontend tự lưu.
- JWT được backend set bằng HttpOnly cookie `access_token`.
- Frontend phải gọi API với credentials/cookie.
- CSRF dùng `XSRF-TOKEN` và header `X-XSRF-TOKEN`.
- Không dùng `localStorage`/`sessionStorage` để lưu JWT.
- Account-service chỉ quản lý tài khoản/hồ sơ cá nhân, không chứa learning profile như mục tiêu học, ngân sách, lịch rảnh.

## Troubleshooting

### Lỗi `Could not resolve placeholder 'JWT_SECRET'`

Nguyên nhân thường là chạy Maven trực tiếp mà chưa load root `.env`.

Cách đúng:

```bash
cd backend/account-service
./run-local.sh
```

### Lỗi port 8080 đang được dùng

Chạy port khác:

```bash
./run-local.sh -Dspring-boot.run.arguments=--server.port=18080
```

### Không gửi được email OTP

Kiểm tra trong `.env`:

```env
MAIL_USERNAME=
MAIL_PASSWORD=
```

Nếu chỉ test UI local, có thể bật:

```env
OTP_LOG_TO_CONSOLE=true
```

### Upload avatar lỗi S3

Kiểm tra các biến:

```env
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

Không đưa AWS credentials vào frontend.
