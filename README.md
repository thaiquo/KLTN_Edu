# EduConnect

EduConnect là nền tảng kết nối gia sư và học viên cho đề tài tốt nghiệp:

> Xây dựng nền tảng kết nối gia sư và học viên ứng dụng AI trong gợi ý ghép nối và Blockchain trong quản lý hợp đồng điện tử.

README này là hướng dẫn dành cho developer, bao gồm cấu trúc repository, yêu cầu môi trường, cách chạy hệ thống, các command thường dùng, cách sử dụng documentation, và workflow làm việc với AI Agent.

README không phải đặc tả đầy đủ của hệ thống và không thay thế `AGENTS.md` hoặc các tài liệu domain trong `docs/`.

## Tổng quan

EduConnect hướng đến một hệ thống đa nền tảng, trong đó:

- Student tìm gia sư/lớp học, gửi yêu cầu, quản lý quá trình học, hợp đồng, tin nhắn, thanh toán, và khiếu nại.
- Tutor quản lý hồ sơ, chuyên môn, lịch rảnh, lớp học, yêu cầu tham gia, hợp đồng, tin nhắn, quá trình học, và thu nhập.
- Staff xét duyệt hồ sơ gia sư, kiểm duyệt nội dung, xử lý vi phạm/khiếu nại, và hỗ trợ người dùng.
- Admin quản lý người dùng, danh mục, giám sát thanh toán, quản trị Blockchain, và báo cáo thống kê.
- AI Matching là capability hỗ trợ tìm kiếm, gợi ý, xếp hạng, và ghép nối.
- Blockchain hỗ trợ kiểm chứng hợp đồng, escrow, settlement/release, refund, và dispute.

Current implementation hiện còn partial. Hãy đọc `docs/IMPLEMENTATION_STATUS.md` để biết trạng thái hiện tại trước khi giả định một flow đã hoàn chỉnh.

## Các miền chức năng chính

| Domain | Tóm tắt Current/Target |
| --- | --- |
| Account | Auth, JWT cookie handling, role/active-role model, profiles, tutor application, staff/admin account operations. |
| Learning | Subjects/catalog, tutor subject registration, availability, classes, schedules/chapters, enrollment requests. |
| Contract | Contract workflow và Blockchain integration đã có trong service logic, nhưng public Contract REST API chưa được chứng minh. |
| Payment | Target tách riêng Student payment/escrow, Tutor income tracking, và Admin payment administration. |
| Blockchain | Solidity escrow contract, Foundry tooling, Web3j integration, và Web wallet code đã tồn tại; Web3 ABI/address conflict vẫn còn. |
| Notification | Service shell đã tồn tại; full notification feature là planned. |
| AI Matching | Target hybrid recommendation đã có trong docs; current source chưa có AI service/Qdrant/Spring AI implementation hoàn chỉnh. |

## Tổng quan kiến trúc

EduConnect sử dụng **Service-Based Architecture**.

Không mô tả repository này là Microservices Architecture nếu chưa có quyết định kiến trúc mới được xác nhận.

Backend hiện được chia thành các Spring Boot service trong `backend/`. Frontend Web và Mobile giao tiếp với Backend thông qua API. Giao tiếp cross-service hiện gồm REST/API usage và một phần RabbitMQ event integration giữa Account và Learning domain.

## Cấu trúc Repository

| Path | Mục đích |
| --- | --- |
| `AGENTS.md` | Workflow và guardrail bắt buộc cho AI Agent. |
| `docs/` | Core baseline/reference documentation và deep-reference notes. |
| `backend/api-gateway/` | Spring Cloud Gateway entry point cho Web/Mobile API traffic. |
| `backend/account-service/` | Account, authentication, roles, profiles, tutor applications, S3 file handling, account events. |
| `backend/learning-service/` | Learning catalog, tutor subjects, availability, classes, schedules, enrollment requests. |
| `backend/contract-service/` | Contract workflow persistence và Web3j Blockchain integration. |
| `backend/notification-service/` | Notification service shell. |
| `backend/eureka-server/` | Được liệt kê trong root Maven modules, nhưng active service source/pom cần verification. |
| `frontend-web/` | React/Vite web application. |
| `mobile-app/` | Expo/React Native mobile application. |
| `blockchain/` | Solidity Smart Contract, Foundry config, scripts, ABI/deployment evidence. |
| `database/` | Database-related project assets. |
| `docker-compose.yml` | Local PostgreSQL và RabbitMQ infrastructure. |
| `Plan/` | Legacy/deep-reference planning và technical documents. |
| `scripts/` | Project scripts. |

## Yêu cầu môi trường

Cài các công cụ cần thiết cho phần bạn muốn chạy:

- Java 21.
- Maven hoặc service-local Maven wrappers.
- Docker với Docker Compose.
- Node.js và npm.
- Expo tooling cho Mobile development.
- Foundry cho Blockchain development: `forge`, `anvil`, và `cast`.
- PostgreSQL/RabbitMQ clients là tùy chọn nhưng hữu ích khi debug.
- MetaMask cần cho browser wallet testing.

## Cấu hình môi trường

Root `.env.example` mô tả các environment variable chính cho local. Tạo file `.env` local khi chạy service.

Không commit secret thật. Không copy hard-coded fallback secrets từ source vào documentation hoặc environment file mới.

### Infrastructure

```env
POSTGRES_PORT=<your-value>
POSTGRES_DB=<your-value>
POSTGRES_USER=<your-value>
POSTGRES_PASSWORD=<your-value>
RABBITMQ_HOST=<your-value>
RABBITMQ_PORT=<your-value>
RABBITMQ_MANAGEMENT_PORT=<your-value>
RABBITMQ_USERNAME=<your-value>
RABBITMQ_PASSWORD=<your-value>
```

### Shared Backend

```env
DB_URL=<your-value>
DB_USERNAME=<your-value>
DB_PASSWORD=<your-value>
JPA_DDL_AUTO=<your-value>
JWT_SECRET=<your-value>
JWT_EXPIRATION=<your-value>
FRONTEND_URL=<your-value>
APP_ENV=<your-value>
```

### API Gateway

```env
API_GATEWAY_PORT=<your-value>
ACCOUNT_SERVICE_URL=<your-value>
LEARNING_SERVICE_URL=<your-value>
ACCOUNT_SERVICE_WS_URL=<your-value>
LEARNING_SERVICE_WS_URL=<your-value>
CORS_ALLOWED_ORIGIN_PATTERNS=<your-value>
GATEWAY_MAX_IN_MEMORY_SIZE=<your-value>
```

### Account Service

```env
ACCOUNT_SERVICE_PORT=<your-value>
AUTH_COOKIE_SECURE=<your-value>
AUTH_COOKIE_SAME_SITE=<your-value>
AUTH_ACCESS_COOKIE_PATH=<your-value>
AUTH_REFRESH_COOKIE_PATH=<your-value>
AUTH_REFRESH_TOKEN_MAX_AGE=<your-value>
MAIL_USERNAME=<your-value>
MAIL_PASSWORD=<your-value>
OTP_MAX_ATTEMPTS=<your-value>
OTP_EXPIRATION=<your-value>
OTP_RESEND_COOLDOWN=<your-value>
OTP_LOG_TO_CONSOLE=<your-value>
STORAGE_PROVIDER=<your-value>
AWS_REGION=<your-value>
AWS_S3_BUCKET=<your-value>
AWS_ACCESS_KEY_ID=<your-value>
AWS_SECRET_ACCESS_KEY=<your-value>
S3_KEY_PREFIX=<your-value>
S3_PRESIGNED_URL_DURATION=<your-value>
MULTIPART_MAX_FILE_SIZE=<your-value>
MULTIPART_MAX_REQUEST_SIZE=<your-value>
```

### Learning Service

```env
LEARNING_SERVICE_PORT=<your-value>
```

### Contract Service

```env
CONTRACT_SERVICE_PORT=<your-value>
BLOCKCHAIN_ENABLED=<your-value>
BLOCKCHAIN_CHAIN_ID=<your-value>
BLOCKCHAIN_RPC_URL=<your-value>
BLOCKCHAIN_ESCROW_ADDRESS=<your-value>
BLOCKCHAIN_USDC_ADDRESS=<your-value>
BLOCKCHAIN_TOKEN_DECIMALS=<your-value>
BLOCKCHAIN_CONFIRMATIONS=<your-value>
BLOCKCHAIN_START_BLOCK=<your-value>
BLOCKCHAIN_EVENT_BLOCK_BATCH_SIZE=<your-value>
BLOCKCHAIN_EVENT_POLL_INITIAL_DELAY_MS=<your-value>
BLOCKCHAIN_EVENT_POLL_INTERVAL_MS=<your-value>
BLOCKCHAIN_OPERATOR_ENABLED=<your-value>
BLOCKCHAIN_OPERATOR_ADDRESS=<your-value>
BLOCKCHAIN_OPERATOR_KEYSTORE_PATH=<your-value>
BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD=<your-value>
BLOCKCHAIN_OPERATOR_GAS_LIMIT=<your-value>
```

### Frontend Web

```env
VITE_API_URL=<your-value>
VITE_REALTIME_URL=<your-value>
VITE_DEFAULT_CHAIN_ID=<your-value>
VITE_ANVIL_RPC_URL=<your-value>
VITE_SEPOLIA_RPC_URL=<your-value>
VITE_ESCROW_CONTRACT_ADDRESS=<your-value>
VITE_USDC_CONTRACT_ADDRESS=<your-value>
VITE_REOWN_PROJECT_ID=<your-value>
VITE_WALLETCONNECT_PROJECT_ID=<your-value>
```

### Mobile

```env
EXPO_PUBLIC_API_URL=<your-value>
```

### Blockchain

```env
LOCAL_RPC_URL=<your-value>
ANVIL_PLATFORM=<your-value>
SEPOLIA_RPC_URL=<your-value>
ACCOUNT=<your-value>
PLATFORM_WALLET=<your-value>
ADMIN_WALLET=<your-value>
ETHERSCAN_API_KEY=<your-value>
```

## Cách chạy hệ thống

### 1. Infrastructure

`docker-compose.yml` hiện chỉ chạy PostgreSQL và RabbitMQ. File này chưa Dockerize các application services.

```bash
docker compose up -d postgres rabbitmq
docker compose ps
```

Xem logs:

```bash
docker compose logs -f postgres
docker compose logs -f rabbitmq
```

### 2. Backend

Các backend service đang active có service-local Maven wrapper. Các script `run-local.sh` load root `.env` và mặc định set profile `dev`.

Chạy mỗi service trong một terminal riêng:

```bash
cd backend/account-service
./run-local.sh
```

```bash
cd backend/learning-service
./run-local.sh
```

```bash
cd backend/contract-service
./run-local.sh
```

```bash
cd backend/api-gateway

```

Trên Windows PowerShell, dùng Maven wrapper trực tiếp nếu không dùng Git Bash:

```powershell
cd backend/account-service
.\mvnw.cmd spring-boot:run
```

Lặp lại pattern này cho `learning-service`, `contract-service`, và `api-gateway` sau khi bảo đảm các environment variable cần thiết đã được set.

`notification-service` hiện là shell service. Nếu cần:

```powershell
cd backend/notification-service
.\mvnw.cmd spring-boot:run
```

### 3. Web

`frontend-web` dùng npm và Vite.

```bash
cd frontend-web
npm install
npm run dev
```

Build và preview:

```bash
npm run build
npm run preview
```

Web client dùng credentialed requests, CSRF handling, và refresh token rotation. Kiểm tra `VITE_API_URL`, gateway CORS settings, cookie flags, và CSRF token flow khi authentication hoạt động không như mong đợi.

### 4. Mobile

`mobile-app` dùng Expo/React Native với npm.

```bash
cd mobile-app
npm install
npm start
```

Các script hiện có:

```bash
npm run android
npm run ios
npm run web
```

Set `EXPO_PUBLIC_API_URL` cho môi trường bạn đang chạy. Android emulator thường dùng `http://10.0.2.2:8080`, và default này đang có trong current mobile API client.

### 5. Blockchain Local Development

`blockchain` dùng Foundry. Sepolia là target test network, nhưng current deployment evidence là local Anvil. Sepolia ETH dùng làm gas; ERC-20/USDC-style test token là escrow asset.

Build và test:

```bash
cd blockchain
forge build
forge test -vvv
```

Nếu có `make`:

```bash
make check
make anvil
make deploy-anvil
```

Nếu không dùng `make`, start Anvil và deploy từ hai terminal riêng:

```bash
cd blockchain
anvil --silent --port 8545
```

```bash
cd blockchain
forge script script/DeployEduConnectEscrow.s.sol:DeployEduConnectEscrow --rpc-url "http://127.0.0.1:8545" --sender "<your-anvil-platform-address>" --unlocked --broadcast -vvv
```

Không coi Sepolia deployment là complete nếu chưa có actual deployment evidence.

## Thứ tự khởi động

Dùng thứ tự này cho local application flow thông thường:

1. Start infrastructure: PostgreSQL và RabbitMQ.
2. Start backend services: Account, Learning, Contract khi cần.
3. Start API Gateway.
4. Start Web.
5. Start Mobile nếu đang phát triển Mobile.
6. Start Anvil và deploy contracts chỉ khi làm local Blockchain/Web3 flows.

## Danh sách Port

| Component | Port | Bắt buộc? | Ghi chú |
| --- | --- | --- | --- |
| PostgreSQL container host port | `5434` by default | Có, cho backend | Compose maps `${POSTGRES_PORT:-5434}` to container `5432`. |
| PostgreSQL container port | `5432` | Internal | Backend `DB_URL` phải khớp host/port có thể truy cập. |
| RabbitMQ AMQP | `5672` by default | Có, cho Account/Learning events | Compose maps `${RABBITMQ_PORT:-5672}`. |
| RabbitMQ Management | `15672` by default | Tùy chọn | Compose maps `${RABBITMQ_MANAGEMENT_PORT:-15672}`. |
| API Gateway | `8080` by default | Có, cho client thông thường | `API_GATEWAY_PORT`. |
| Account Service | `8081` by default | Có, cho auth/profile | `ACCOUNT_SERVICE_PORT`. |
| Learning Service | `8082` by default | Có, cho learning/class | `LEARNING_SERVICE_PORT`. |
| Contract Service | `8083` by default | Tùy chọn/current partial | `CONTRACT_SERVICE_PORT`; public REST API chưa được chứng minh. |
| Frontend Web | `5173` theo Vite default | Có, cho Web dev | Vite dev server. |
| Mobile Expo | Không cố định bởi repo | Tùy chọn | Expo in runtime URL/port ra terminal. |
| Anvil | `8545` | Chỉ cho Blockchain local | Dùng cho Foundry local development. |

## Các lệnh thường dùng

### Infrastructure

```bash
docker compose up -d postgres rabbitmq
docker compose ps
docker compose logs -f postgres
docker compose logs -f rabbitmq
docker compose down
```

### Backend

```bash
cd backend/account-service && ./run-local.sh
cd backend/learning-service && ./run-local.sh
cd backend/contract-service && ./run-local.sh
cd backend/api-gateway && ./run-local.sh
```

```powershell
cd backend/account-service
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

### Web

```bash
cd frontend-web
npm install
npm run dev
npm run build
```

### Mobile

```bash
cd mobile-app
npm install
npm start
npm run android
npm run web
```

### Blockchain

```bash
cd blockchain
forge build
forge test -vvv
make check
make anvil
make deploy-anvil
```

## Tài liệu dự án

EduConnect dùng mô hình documentation hai tầng:

- `AGENTS.md`: workflow và guardrail bắt buộc cho AI Agent.
- `docs/`: core baseline/reference documentation của EduConnect.
- Deep-reference docs: tài liệu kỹ thuật chi tiết, chỉ đọc khi task liên quan đến domain đó.
- Source code: phản ánh current implementation của task đang xử lý.
- Latest user-confirmed requirement: có thể thay đổi hoặc thay thế baseline cũ.

Tài liệu là nền móng và ngữ cảnh để phát triển EduConnect. Nó không phải đặc tả đầy đủ, không phải feature whitelist, và không phải ràng buộc rằng source phải khớp từng dòng trong docs một cách máy móc.

Nên bắt đầu từ:

- `docs/PROJECT.md`
- `docs/IMPLEMENTATION_STATUS.md`
- domain docs như `docs/ARCHITECTURE.md`, `docs/AUTH_SECURITY.md`, `docs/API.md`, `docs/BLOCKCHAIN.md`, và `docs/AI_MATCHING.md` khi liên quan.

## Làm việc với AI Agent

Workflow khuyến nghị:

Yêu cầu người dùng -> `AGENTS.md` -> Core Docs -> xác định scope/domain -> relevant deep-reference docs -> audit relevant source -> đề xuất giải pháp -> implement -> test/validate -> cập nhật docs khi cần.

AI Agent không nên scan toàn bộ repository cho mọi task. Hãy bắt đầu từ scope liên quan và chỉ mở rộng khi dependency yêu cầu.

### Prompt: Audit Feature

```text
Tuân thủ AGENTS.md và documentation workflow của repository.

Tôi muốn triển khai:
[FEATURE]

Trước tiên:
- audit implementation hiện tại;
- xác định domain/service liên quan;
- đọc documentation liên quan như baseline/reference;
- kiểm tra source trong scope;
- báo phần đã có, còn thiếu, conflict và dependency;
- đề xuất hướng triển khai.

Chưa sửa code.
```

### Prompt: Implement Feature

```text
Tuân thủ AGENTS.md.

Triển khai:
[FEATURE]

Dựa trên audit/phương án đã chốt.

Yêu cầu:
- chỉ thay đổi trong scope cần thiết;
- không tự thay đổi architecture/domain ownership;
- reuse implementation hiện có;
- cập nhật BE/FE/Mobile chỉ khi flow yêu cầu;
- chạy validation/test liên quan;
- báo file thay đổi và kết quả.
```

### Prompt: Fix Bug

```text
Tuân thủ AGENTS.md.

Bug:
[BUG DESCRIPTION]

Hãy:
- reproduce/trace nguyên nhân từ source;
- xác định root cause;
- kiểm tra impact;
- sửa tối thiểu đúng nguyên nhân;
- không workaround bằng cách phá security/business rule;
- chạy test/validation;
- báo root cause và file thay đổi.
```

### Prompt: Build UI

```text
Tuân thủ AGENTS.md.

Tôi muốn xây UI cho:
[FEATURE]

Trước tiên audit:
- backend API hiện có;
- DTO/request/response;
- authorization;
- frontend patterns hiện tại;
- reusable components.

Sau đó đề xuất UI flow.
Không mock API nếu backend thực tế đã tồn tại.
```

### Prompt: Backend API

```text
Tuân thủ AGENTS.md.

Tôi muốn triển khai backend cho:
[FEATURE]

Audit trước:
- domain owner;
- Entity;
- Repository;
- Service;
- Controller;
- DTO;
- security;
- migration;
- cross-service dependency/event.

Không duplicate domain đã có ở service khác.
```

### Prompt: Change Business Flow

```text
Tuân thủ AGENTS.md.

Tôi muốn thay đổi business flow:
[OLD FLOW / NEW REQUIREMENT]

Trước khi code:
- xác định source bị ảnh hưởng;
- xác định docs bị ảnh hưởng;
- xác định API/database/event/security impact;
- báo breaking changes;
- đề xuất migration/refactor plan.

Chưa implement cho đến khi impact được review.
```

### Prompt: Blockchain

```text
Tuân thủ AGENTS.md.

Blockchain task:
[TASK]

Đọc docs/BLOCKCHAIN.md và relevant deep-reference docs.
Audit Solidity trước vì Solidity là Smart Contract interface source of truth.

Sau đó audit:
- Contract Service;
- frontend Web3;
- deployment/config liên quan.

Không gửi transaction hoặc deploy nếu chưa được yêu cầu.
```

### Prompt: AI Matching

```text
Tuân thủ AGENTS.md.

AI task:
[TASK]

Đọc docs/AI_MATCHING.md.
Audit search/profile/class data và implementation hiện tại trước.

Phân biệt:
- core search;
- hard filtering;
- ranking;
- semantic/embedding;
- planned vs implemented.

Không biến AI thành dependency bắt buộc của core business flow.
```

## Trạng thái phát triển hiện tại

- AI Matching service, Qdrant, Spring AI, embeddings, và semantic search là planned/not implemented trong current source.
- Authentication Web hiện dùng short-lived `access_token` cookie, `refresh_token` HttpOnly Cookie, refresh token rotation, và revoke refresh sessions khi logout/reset/change password.
- Contract Service có persistence/workflow/Web3j logic, nhưng public Contract REST API evidence hiện chưa được tìm thấy.
- Frontend Web3 hiện còn ABI/address conflict với current Solidity/deployment evidence.
- Local Anvil evidence đã tồn tại; Sepolia deployment là planned/configured nhưng chưa được chứng minh bằng deployment evidence.
- Mobile app chưa feature-equivalent với Web.
- Notification Service là shell.
- Learning Service hiện bao phủ catalog/class/enrollment areas; session, attendance, và homework vẫn là planned/not implemented.
- Root Maven module listing có `backend/eureka-server`, nhưng active service source/pom cần verification.

## Xử lý lỗi thường gặp

| Triệu chứng | Cần kiểm tra |
| --- | --- |
| Backend không kết nối được database | Kiểm tra `docker compose ps`, `DB_URL`, và host PostgreSQL port. |
| RabbitMQ event flow không hoạt động | Kiểm tra RabbitMQ container, `RABBITMQ_*` variables, exchange/queue declarations, và service logs. |
| Login thành công nhưng browser requests fail | Kiểm tra `VITE_API_URL`, gateway CORS origins, credentialed requests, và CSRF token flow. |
| Phiên đăng nhập hết hạn nhanh | Kiểm tra refresh flow `POST /api/auth/refresh`, `refresh_token` cookie, CSRF token, và refresh session trong database. |
| CSRF errors | Kiểm tra frontend requests `XSRF-TOKEN`/`X-XSRF-TOKEN` behavior và không bypass cookie auth rules. |
| Port đã được sử dụng | Override `*_PORT` tương ứng trong `.env`. |
| Web3 local transaction fail | Re-check Solidity ABI, exported frontend ABI, Anvil chain ID, escrow address, và ERC-20 token address. |
| Sepolia flow có config nhưng chưa deploy | Xem config chỉ là configuration; cần actual deployment evidence trước khi gọi là implemented. |
