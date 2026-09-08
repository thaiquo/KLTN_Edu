# EduConnect Architecture

## 1. Architecture Style

EduConnect uses a Service-Based Architecture.

The backend is split by business-oriented services with separate responsibility boundaries. Web and Mobile clients call backend APIs through the gateway or service API surface. Some flows use synchronous REST/API communication, and some existing Account/Learning flows use asynchronous RabbitMQ events.

Do not rename the system to Microservices Architecture unless the user confirms a new architecture decision.

## 2. Current Service Map

| Service | Main Responsibility | Current Status |
| --- | --- | --- |
| `api-gateway` | Spring Cloud Gateway routing, CORS entry point, WebSocket route forwarding. | IMPLEMENTED |
| `account-service` | Authentication, users, roles, active role, student/tutor profiles, tutor applications, staff/admin account operations, S3 file storage, Account/Learning events. | IMPLEMENTED |
| `learning-service` | Teaching catalog, tutor subject registration, tutor availability, classes, chapters/schedules, enrollment requests, Learning/Account events. | PARTIAL |
| `contract-service` | Contract agreement data, escrow/payment metadata, dispute/session settlement workflows, blockchain transaction dispatch, event polling/ingestion. | PARTIAL |
| `notification-service` | Persistent account-owned notifications, REST Bell APIs, RabbitMQ consumers, idempotency, and limited realtime notification delivery. | PARTIAL |
| `eureka-server` | Service discovery module is present in the Maven/backend structure. Runtime role needs verification before relying on it. | NEEDS_VERIFICATION |

No `ai-service` source module is currently present.

## 3. Domain Ownership

- Account Service owns authentication, user identity, roles, active role, student profile, tutor profile, tutor applications, tutor documents, and account-side staff/admin operations.
- Learning Service owns teaching catalog, tutor subject/expertise registration, tutor availability, class/classroom data, class schedules/chapters, and enrollment/join request data.
- Contract Service owns contract agreement data, escrow payment metadata, settlement/dispute state, lifecycle cancellation/expiration state, blockchain transaction records, outbox records, and blockchain event cursor/processed event data.
- Notification is implemented as a partial domain capability: persistent notifications, REST Bell APIs, limited RabbitMQ consumers, and raw WebSocket delivery exist, but not every notification-worthy business event is covered.
- AI Matching is target/planned. Current search/filter logic lives in existing Account/Learning APIs rather than a dedicated AI service.

Contract funding is event-confirmed: frontend/backend payment submission may record a funding txHash as `PAYMENT_CONFIRMING`, but Contract Service only moves an agreement to `ACTIVE`, locks escrow metadata, sends activation notifications, and dispatches Learning enrollment activation after ingesting a confirmed `AgreementFunded` event.

Contract lifecycle after funding is also event-confirmed. Contract Service enqueues backend-owned operator/arbitrator transactions for session proposals, finalization, tutor-fraud dispute opening/resolution, expiration, and cancellation/refund through the durable blockchain transaction pipeline. It only marks session payout/refund, dispute open/resolved, agreement completed/expired/cancelled, and unused-refund records after the corresponding escrow events are ingested.

Frontend IA separates `Ví của tôi` from `Thanh toán & Ký quỹ`: `Ví của tôi` is wallet-focused Web3 access, while `Thanh toán & Ký quỹ` remains the payment/escrow workflow entry. Current Web UI reuses `MyWalletView` for both access paths until dedicated payment/escrow APIs are complete.

## 4. Data Ownership

PostgreSQL is used for current business data. Each service should own data for its domain and avoid direct database coupling with another service's domain.

Cross-domain integration should go through an API or event flow when possible. Before adding an Entity/table, audit whether another service already owns that business concept.

## 5. Service Communication

### Synchronous

- Web/Mobile clients call REST-style APIs exposed by backend services, usually through `api-gateway`.
- `api-gateway` currently routes Account and Learning API groups.
- Account Service uses Feign integration with Learning Service for selected tutor/learning validation flows.

### Asynchronous

RabbitMQ is currently present for Account/Learning events through exchange `kltn.edu.events`.

Known implemented event direction:

| Producer | Event Purpose | Consumer |
| --- | --- | --- |
| Account Service | Tutor application submitted/approved/rejected. | Learning Service consumes tutor approval/rejection events. |
| Learning Service | Subject request approved/rejected. | Account Service consumes subject request decision events. |

No proven end-to-end Learning session/attendance flow currently triggers Contract settlement automatically. Manual Contract Service APIs/UI actions can enqueue settlement lifecycle transactions, but learning-session eligibility remains a separate incomplete domain.

## 6. API Gateway

`api-gateway` is the main backend entry point for Web/Mobile routing.

Current evidence shows:

- Account routes under `/api/account/**`, `/api/auth/**`, `/api/users/**`, `/api/admin/**`, `/api/tutors/**`, `/api/tutor-applications/**`, `/api/staff/**`, and `/api/reference/**`.
- Learning routes under `/api/learning/**`.
- Contract routes under `/api/contracts/**`.
- WebSocket forwarding for `/ws/account`, `/ws/learning`, and `/ws/notifications`.
- Credentialed CORS for local frontend origins.
- Gateway forwards authenticated browser cookies to services and is not the identity authority for Contract Service. Contract Service validates the `access_token` cookie itself and ignores spoofable client identity headers/query parameters for authorization.

Gateway route details belong in source/config and API-specific documentation, not in this architecture baseline.

## 7. Infrastructure Baseline

- PostgreSQL: implemented as the relational database infrastructure.
- RabbitMQ: implemented for part of Account/Learning async messaging.
- Amazon S3: implemented in Account Service for avatar/tutor document storage.
- Docker Compose: currently provides infrastructure containers such as PostgreSQL and RabbitMQ. Application services are not fully Dockerized in the current compose file.
- Blockchain: Solidity/Foundry contract source exists; backend Web3j integration exists in Contract Service; Sepolia is target/configured, while current deployment evidence is local/Anvil.
- Qdrant/Spring AI: planned for AI Matching; no current implementation evidence.

## 8. Architecture Guardrails

- Keep the Service-Based Architecture baseline.
- Do not create a new service without explicit user confirmation.
- Do not move domain ownership without explicit user confirmation.
- Do not duplicate Entity/domain ownership when an owner already exists.
- Do not access another service's database directly unless a confirmed design decision requires it.
- For cross-service flows, identify the source domain owner and target consumer before changing APIs/events.

## 9. Where to Audit

- Auth/Profile/Role/Tutor application: start in `backend/account-service`.
- Class/Homework/Session/Catalog/Enrollment: start in `backend/learning-service`.
- Contract/Escrow/Settlement/Dispute: start in `backend/contract-service`.
- Blockchain interface/deployment/Web3: start in `blockchain/`, then `backend/contract-service`, then `frontend-web/src/web3`.
- Web API integration: start in `frontend-web/src/api` and related components.
- Mobile API integration: start in `mobile-app`.
- Gateway/routing/CORS: start in `backend/api-gateway/src/main/resources/application.properties`.
