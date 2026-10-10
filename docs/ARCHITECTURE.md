# EduConnect Architecture

> Post-merge baseline: 2026-10-10. EduConnect uses **Service-Based Architecture** with REST, RabbitMQ events, WebSocket realtime, PostgreSQL/Flyway and Sepolia blockchain integration. Matching and chatbot capabilities are owned by AI Service, not by separate services.

## 1. System Map

```text
React/Vite Web + Expo Mobile
        |
        | HTTP cookies / CSRF / WebSocket
        v
API Gateway :8080
  |-- Account Service :8081
  |-- Learning Service :8082
  |-- Contract Service :8083
  |-- Notification Service :8084
  `-- AI Service :8085

RabbitMQ exchange: kltn.edu.events
PostgreSQL: service-owned schemas/migrations in the shared local database
Object storage: S3/local abstractions per owning service
Blockchain: EduConnectEscrow on Sepolia, funded with USDC; Sepolia ETH is gas only
Qdrant: semantic retrieval for tutor/class/chatbot knowledge flows
```

Gateway routes the current REST families and WebSocket paths: `/api/auth`, `/api/users`, `/api/tutors`, `/api/reference`, `/api/learning/**`, `/api/community/**`, `/api/contracts/**`, `/api/notifications/**`, `/api/chat/**`, `/api/ai/**`, `/ws/account`, `/ws/learning`, `/ws/notifications`, and `/ws/chat`.

## 2. Service Ownership

| Service | Owns | Notes |
| --- | --- | --- |
| `account-service` | Authentication, users/roles, active role, Student/Tutor profiles, Tutor application identity data, geography reference data, internal active Staff/Admin notification recipient lookup. | Browser auth uses HttpOnly JWT cookies. Internal recipient lookup is service-token protected. |
| `learning-service` | Teaching catalog, tutor authorization/subjects, tutor availability, public Tutor/Class learning data, classrooms, enrollment, sessions, attendance, homework, reviews, Community posts/polls/interactions/bookmarks, post-to-class behavior. | Community schema is in Learning Flyway V8. |
| `contract-service` | E-contract, EIP-712 signing, final PDF/artifacts, escrow/payment lifecycle, blockchain reconciliation, settlement, disputes, termination governance, termination outbox, Contract -> Learning lifecycle events. | Contract is the source of truth for termination governance. |
| `notification-service` | Persisted Bell notifications, Rabbit consumers, notification WebSocket, human Student-Tutor messaging, chat attachments metadata, chat REST/WebSocket. | Human messaging is not the AI chatbot. |
| `ai-service` | Tutor Matching, Class Matching, Gemini analysis/grounding, Qdrant semantic retrieval, Matching V3 explainable scoring, AI chatbot, chatbot RAG, public lookup/count tools, authenticated Student/Tutor read-only chatbot tools. | Matching and chatbot stay inside AI Service. |
| `api-gateway` | Edge routing, credentialed CORS, cookie forwarding, REST/WebSocket proxying. | Gateway is not an identity authority. |
| `frontend-web` | Marketplaces, portals/dashboard, Community UI, contract/termination UI, human Messages, shared global AI chatbot widget. | AI Matching is integrated into Tutor/Class marketplace and chatbot flows, not a standalone `/matching` product route. |

## 3. Security Baseline

- Browser authentication uses `access_token` and refresh cookies; protected services derive identity server-side.
- State-changing browser requests require CSRF handling.
- CORS is credentialed and routed through the Gateway for Web.
- Authorization uses roles and the current `activeRole`; changing the role model requires explicit approval.
- Internal service endpoints are not public APIs. Current examples:
  - Account `GET /api/internal/notification-reviewers` requires `X-Service-Token` signed with subject `contract-service` and scope `notification-recipients`.
  - Notification `POST /api/notifications/internal/send` requires subject `contract-service` and scope `notification-send`.

## 4. Human Messaging vs AI Chatbot

Human Messaging belongs to `notification-service`.

- Student <-> approved Tutor direct conversations.
- REST APIs under `/api/chat/**`.
- Realtime frames on `/ws/chat`.
- Message history, unread/read state and image/video attachment metadata are persisted by Notification Service.

AI chatbot belongs to `ai-service`.

- HTTP flow under `POST /api/ai/chat`.
- Shared global widget in Web.
- Uses RAG/tools/matching adapters where implemented.
- Does not write to human chat conversation tables and does not use `/ws/chat`.

## 5. Matching Architecture

Tutor Matching is integrated into Tutor Marketplace and chatbot flows:

- Manual/public search remains available through the marketplace.
- AI flow is Analyze -> Ground -> Match.
- Grounding resolves catalog/location against Learning/Account reference data.
- Qdrant supplies semantic evidence when applicable.
- Matching V3 keeps deterministic backend scoring, dynamic denominator behavior, explainable score breakdown, matching reasons and mismatch reasons.
- No standalone `/matching` product route should be documented or restored.

Class Matching is separate:

- Public class data is sourced from Learning.
- AI Class flow is Analyze -> Ground -> Match.
- Public class semantic indexing uses Qdrant.
- Hard eligibility remains authoritative in Learning/public class data.
- Chatbot can call public class lookup/matching tools; it does not own class data.

## 6. Community Architecture

Community belongs to `learning-service`.

Implemented high-level concepts:

- `community_posts`
- poll records/options/votes
- interactions, comments and bookmarks
- Student search/group posts
- Tutor announcements, polls and class sharing
- Community -> class conversion using the shared class creation behavior where implemented

Learning emits Community realtime and notification events after transactions commit. Notification Service consumes supported Community RabbitMQ events and persists Bell notifications. Staff/Admin moderation should not be documented as complete unless source later implements it.

## 7. Contract Termination Architecture

Contract Service owns termination governance.

- `termination_cases`, items/evidence and status transitions are Contract-owned.
- Student agreement termination and Tutor whole-class cancellation are submitted through Contract APIs.
- Response deadlines and automatic absence handling are represented in Contract state where implemented.
- Termination notification delivery uses Contract V18 transactional outbox plus internal Notification send.
- Contract synchronizes lifecycle/cutoff effects to Learning; Learning stores the resulting hold/cutoff state but does not own termination decisions.
- Frontend displays termination/refund progress for Student, Tutor, Staff and Admin according to role scope.

## 8. Event Architecture

RabbitMQ exchange: `kltn.edu.events`.

Verified event families include:

| Producer | Consumer | Routing key / family | Purpose |
| --- | --- | --- | --- |
| Account | Notification | `account.tutor-application.submitted` | Staff Bell notification for submitted Tutor applications. |
| Learning | Notification | `learning.teaching-registration.submitted` | Staff/Admin review notification. |
| Learning | Notification | `learning.subject-request.submitted` | Staff/Admin review notification. |
| Learning | Notification | `learning.class.submitted` | Staff/Admin class review notification. |
| Learning | Notification | `learning.community-post.converted` | Notify voters/participants after post-to-class conversion. |
| Learning | Notification | `learning.community-post.interaction` | Notify post/comment/reply recipients. |
| Contract | Learning | `contract.activated.v1` | Activate enrollment/class lifecycle after confirmed funding. |
| Contract | Learning | `contract.expired.v1` | Expire learning enrollment/class lifecycle after confirmed contract expiration. |

Other existing valid notification events may remain supported by source, but docs should not introduce speculative event names. Blockchain financial state is confirmed by Contract's transaction/event pipeline, not RabbitMQ alone.

## 9. Data and Flyway

Each service owns its data model even when local development uses the same PostgreSQL database.

| Service | Current migration baseline | Representative data |
| --- | --- | --- |
| Account | Account chain through V15 in current source/history | users, roles, refresh sessions, OTP, students, tutors, tutor applications/documents. |
| Learning | Compact V1..V8 | legacy compatibility, normalized catalog, tutor registrations, classrooms, sessions/homework/materials, reviews, Community posts/polls. |
| Contract | Continuous V1..V19 | agreements, acceptances, artifacts, escrow payments, settlements, disputes/evidence, blockchain transactions/events, termination governance/outbox. |
| Notification | V1..V2 | notifications, conversations, chat messages and chat attachments. |

Older high-numbered Learning migrations are not active post-merge migrations. Community is represented by compact Learning V8.

## 10. Storage and Documents

- Account stores avatars and Tutor identity documents through S3/local storage abstractions and returns time-limited access URLs.
- Learning stores classroom materials, syllabus, session files and homework submissions through its file storage abstraction.
- Contract stores final contract PDFs and evidence through its artifact storage abstraction. Final contract PDF retention is implemented; DOCX is a transient conversion input.
- Notification stores chat attachment bytes in private S3 and persists metadata/object keys; WebSocket never sends binary payloads.

## 11. Blockchain and Escrow

- Solidity `EduConnectEscrow` is the ABI/rule source of truth.
- USDC/ERC-20 test token is the escrow asset; Sepolia ETH is gas only.
- Browser writes are limited to party signatures and Student funding actions.
- Backend operator/arbitrator pipeline handles register/propose/finalize/dispute/expire/cancel flows.
- Domain state and confirmed financial amounts should move only after confirmed contract events are ingested.

## 12. Current Limits

- Mobile does not have Web parity.
- Some dashboard/reporting surfaces remain partial.
- Blockchain ops still need production-grade multi-RPC/failover/monitoring hardening.
- Staff/Admin Community moderation is not documented as implemented.
- Runtime behavior requires running the latest merged services; build/test success alone is not production readiness.
