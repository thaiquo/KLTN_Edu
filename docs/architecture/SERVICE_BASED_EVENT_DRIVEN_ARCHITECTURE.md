# EduConnect Architecture & Event Integration Blueprint

> **Architecture Style**: Service-Based Architecture  
> **Messaging Style**: Selective Event-Driven (Outbox + RabbitMQ)  
> **Status**: APPROVED ARCHITECTURE BASELINE  

---

## 1. Executive Architecture Principles

1. **Service-Based Architecture Foundation**:
   - EduConnect is organized as a cohesive, modular Service-Based Architecture consisting of **6 core backend services** (`account-service`, `learning-service`, `contract-service`, `ai-service`, `notification-service`, `api-gateway`).
   - **No Microservice Proliferation**: We explicitly reject decomposing into dozens of fine-grained microservices. Service boundaries follow macro business domains to maintain system stability, operational simplicity, and high query performance.

2. **Synchronous vs. Asynchronous Demarcation**:
   - **REST APIs**: Used for real-time operations, user interactions, direct CRUD queries, authentication/authorization, and immediate command responses.
   - **Event-Driven (RabbitMQ / Outbox)**: Used exclusively for asynchronous workflows, non-blocking side-effects, audit logging, multi-channel notifications, AI index updates, and blockchain confirmation processing.

---

## 2. Service Boundaries & Domain Ownership

```
                        +--------------------+
                        |    Web / Mobile    |
                        +---------+----------+
                                  | (HTTPS / REST / WSS)
                        +---------v----------+
                        |    API Gateway     |
                        +----+----+----+-----+
                             |    |    |
        +--------------------+    |    +--------------------+
        |                         |                         |
+-------v-------+        +--------v------+        +---------v---------+
| Account       |        | Learning      |        | Contract          |
| Service       |        | Service       |        | Service           |
| (Auth/Profile)|        | (Tutor/Class) |        | (Escrow/Agreement)|
+---------------+        +---------------+        +---------+---------+
        |                        |                          |
        | Outbox                 | Outbox                   | Outbox
        v                        v                          v
+---------------------------------------------------------------------+
|                      Message Broker (RabbitMQ)                      |
+--------------------+--------------------+---------------------------+
                     |                    |
                     v                    v
           +---------+-------+  +---------+-------+
           | AI Matching     |  | Notification    |
           | Service         |  | Service         |
           +-----------------+  +-----------------+
```

### Domain Mapping & Responsibilities

| Service | Architecture Role | Communication Model | Primary Storage |
|---|---|---|---|
| **Account Service** | Authentication, User Profiles, RBAC | REST (Auth) + Event (Outbox for profile updates) | PostgreSQL |
| **Learning Service** | Tutor Requests, Classrooms, Attendance | REST (Class Mgmt) + Event (Outbox for request changes) | PostgreSQL |
| **Contract Service** | Smart Contracts, Escrow Lifecycle, Web3j | REST (Agreement state) + Event Ingestion/Outbox | PostgreSQL |
| **AI Matching Service** | Hybrid Recommendation (Content-Based + CF) | REST (Get recommendations) + Async Event Listener | Vector DB / Redis |
| **Notification Service** | Multi-channel Alerts (Push, Email, In-App) | Event-Driven Consumer only | Redis / DB |
| **API Gateway** | Routing, Rate Limiting, JWT Verification | REST Proxy | N/A |

---

## 3. Design Patterns Framework

### 3.1 Design Patterns Matrix

```
+-----------------------------------------------------------------------------+
|                            DESIGN PATTERNS MATRIX                           |
+-----------------------+-----------------------------------------------------+
| Strategy Pattern      | Hybrid Recommendation (Content-Based vs. CF)      |
| State Pattern         | Contract Agreement & Escrow Lifecycle               |
| Observer Pattern      | Multi-channel Notification Events                   |
| Outbox Pattern        | Transactional Event Dispatch (DB -> Broker)         |
| Saga Pattern          | Distributed Agreement & Payment Workflows           |
+-----------------------+-----------------------------------------------------+
```

1. **Strategy Pattern**:
   - Used inside `AI Matching Service` to switch dynamically between Recommendation Strategies (e.g., Content-Based Filtering for new tutors/students vs. Collaborative Filtering for active users).

2. **State Pattern**:
   - Enforced strictly in `Contract Service` via strict state machine (`DRAFT -> PENDING_TUTOR_ACCEPTANCE -> PENDING_STUDENT_ACCEPTANCE -> PREPARING_BLOCKCHAIN -> WAITING_PAYMENT -> PAYMENT_CONFIRMING -> ACTIVE -> COMPLETED`).

3. **Observer Pattern**:
   - Implemented in `Notification Service` to react to domain events (`agreement.registered`, `payment.confirmed`, `session.settled`) and push real-time alerts.

4. **Outbox Pattern**:
   - Guarantees **At-Least-Once Delivery** without dual-write inconsistency. Domain entities and outbox records commit in the same local database transaction.

5. **Saga Pattern (Choreography / Orchestration)**:
   - Coordinates multi-service processes (e.g., Student accepts contract -> Contract Service prepares blockchain -> Ingestion confirms on-chain event -> Notification Service alerts Student to fund escrow).

---

## 4. Security Architecture

1. **Authentication & Authorization**: JWT token verification at API Gateway with RBAC (Role-Based Access Control: `STUDENT`, `TUTOR`, `STAFF`, `ADMIN`).
2. **Data Protection**: HTTPS/TLS in transit, BCrypt password hashing, End-to-End Encryption (E2EE) for Chat messaging payload.
3. **Web3 Key Management**: Private keys for operator signers are managed exclusively inside `Contract Service` using Web3j encrypted keystores. Student/Tutor keys are never stored on the server.

---

## 5. Implementation Standard for Event Ingestion & Outbox

```text
Local DB Transaction:
  1. Save/Update Entity State
  2. Insert OutboxEvent (topic, payload_json, status='PENDING')
  3. Commit Transaction
Worker Task:
  4. Poll PENDING Outbox Events -> Publish to RabbitMQ -> Mark 'PUBLISHED'
Consumer Service:
  5. Consume Event -> Check Consumer Idempotency Key -> Process Domain Action
```

- **Reorg Safety**: On-chain logs processed by `BlockchainEventIngestionService` are persisted only after confirmation block depth check, with unique constraint `(chain_id, transaction_hash, log_index)`.
