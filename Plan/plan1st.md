# EduConnect - System Architecture & Development Guide

## 1. Overview

EduConnect is a tutoring platform that connects students and tutors, supporting:

- Class management
- Real-time chat
- Assignment submission
- AI chatbot (RAG)
- Recommendation system
- Blockchain-based escrow payment

---

## 2. Architecture

### 2.1 Architecture Style

Hybrid Service-Based Architecture:

- Modular Monolith (Core Backend)
- Service-based (Chat, AI, File)
- Event-driven communication
- AI Integration (RAG + Recommendation)
- Blockchain Escrow Payment

---

### 2.2 High-Level Architecture

Client (Next.js / React Native)
→ API Gateway
→ Core Backend (NestJS)
→ Side Services
→ Data Layer

---

### 2.3 Components

#### Core Backend (NestJS)

- Auth Module
- User Module
- Class Module
- Enrollment Module
- Session Module
- Assignment Module
- Payment Module
- Contract Module

#### Side Services

- Chat Service (Socket.IO)
- AI Service (RAG + Recommendation)
- File Service (AWS S3)

#### Data Layer

- MongoDB (main data)
- Qdrant (vector search)
- Blockchain (Smart Contract - Escrow)

---

## 3. Core Domain Model

---

### 3.1 User

```ts
User {
  _id: string
  email: string
  password: string
  role: "student" | "tutor" | "admin"
  createdAt: Date
}
```

---

### 3.2 Profile

```ts
Profile {
  userId: string
  name: string
  avatar: string
  bio: string
}
```

---

### 3.3 TutorProfile

```ts
TutorProfile {
  userId: string
  subjects: string[]
  experience: number
  pricePerSession: number
  location: {
    lat: number
    lng: number
  }
}
```

---

### 3.4 Post (Student request)

```ts
Post {
  _id: string
  studentId: string
  subject: string
  level: string
  description: string
  budget: number
  location: object
}
```

---

### 3.5 MatchRequest

```ts
MatchRequest {
  _id: string
  postId: string
  tutorId: string
  status: "pending" | "accepted" | "rejected"
}
```

---

### 3.6 ClassRoom

```ts
ClassRoom {
  _id: string
  tutorId: string
  studentIds: string[]
  pricePerSession: number
  contractAddress: string
}
```

---

### 3.7 Enrollment

```ts
Enrollment {
  classId: string
  studentId: string
}
```

---

### 3.8 Session

```ts
Session {
  _id: string
  classId: string
  date: Date
  status: "scheduled" | "completed"
}
```

---

### 3.9 Attendance

```ts
Attendance {
  sessionId: string
  userId: string
  present: boolean
}
```

---

### 3.10 Assignment

```ts
Assignment {
  _id: string
  classId: string
  title: string
  description: string
  fileUrl: string
}
```

---

### 3.11 Submission

```ts
Submission {
  assignmentId: string
  studentId: string
  fileUrl: string
  score: number
}
```

---

### 3.12 Payment

```ts
Payment {
  sessionId: string
  amount: number
  status: "pending" | "paid"
  txHash: string
}
```

---

### 3.13 Contract

```ts
Contract {
  classId: string
  contractAddress: string
  balance: number
}
```

---

## 4. Key System Flows

---

### 4.1 Class Creation

1. Student creates Post
2. Tutor sends MatchRequest
3. Student accepts
4. Create ClassRoom
5. Deploy Smart Contract
6. Save contractAddress

---

### 4.2 Session + Attendance

1. Tutor creates Session
2. Students check-in
3. Save Attendance
4. End session

---

### 4.3 Escrow Payment (IMPORTANT)

Rules:

- Both present:
  - Tutor: 90%
  - Platform: 10%

- Student absent:
  - Tutor: 40%
  - Platform: 10%
  - Student refund: 50%

- Tutor absent:
  - Student refund: 100%

---

Flow:

1. Get attendance
2. Calculate payment
3. Call smart contract
4. Transfer funds
5. Save txHash

---

### 4.4 Assignment Flow

1. Tutor creates assignment
2. Upload file to S3
3. Students submit
4. Tutor grades

---

### 4.5 Chat Flow

1. User sends message
2. Save MongoDB
3. Broadcast via Socket.IO

---

### 4.6 AI Chatbot (RAG)

1. User sends question
2. Convert to embedding
3. Search Qdrant
4. Send context to Gemini
5. Return answer

---

### 4.7 Recommendation System

FinalScore = VectorScore _ 0.4 + RuleScore _ 0.6

---

## 5. Development Roadmap

---

### Phase 1 (Core)

- Auth
- User
- Class
- Enrollment

---

### Phase 2

- Session
- Attendance

---

### Phase 3

- Assignment
- File upload (S3)

---

### Phase 4

- Chat Service

---

### Phase 5

- AI Service (RAG + Recommendation)

---

### Phase 6

- Payment + Blockchain

---

## 6. Important Notes

- Do NOT implement AI first
- Do NOT implement blockchain first
- Attendance is required for payment
- Use MongoDB for main data
- Use Qdrant only for embeddings
- Store txHash for every payment

---

## 7. Final Summary

EduConnect uses:

- Service-Based Architecture
- Event-Driven Communication
- AI-powered modules
- Blockchain escrow payment
- Modular scalable design

---

# EduConnect - Architectural Design (Clean Version)

## 1. Overview

EduConnect is a tutoring platform designed to connect students and tutors, supporting:

- Class management
- Real-time communication
- Assignment submission
- AI chatbot (RAG)
- Recommendation system
- Blockchain-based escrow payment

This document focuses on **system architecture and structure**, not implementation details or fixed business formulas.

---

## 2. Architecture Style

EduConnect adopts a **Hybrid Service-Based Architecture**, combining:

- Modular Monolith (Core system)
- Service-Based Architecture (separate services)
- Event-Driven Architecture (communication)
- AI Integration Layer
- Blockchain Escrow Layer

---

## 3. High-Level Architecture

Client (Web / Mobile)
→ API Gateway
→ Core Backend (NestJS)
→ Side Services
→ Data Layer

---

## 4. Core Backend (Modular Monolith)

### 4.1 Description

The system core is built as a **Modular Monolith**, meaning:

- One deployable backend
- Clearly separated internal modules
- Shared database

---

### 4.2 Modules

- Auth Module
- User Module
- Class Module
- Enrollment Module
- Session Module
- Assignment Module
- Payment Module
- Contract Module

---

### 4.3 Responsibility

Core Backend handles:

- Business logic
- Data validation
- System coordination
- Triggering events

---

## 5. Service-Based Architecture

### 5.1 Description

Some components are separated into independent services due to:

- Performance requirements
- Scalability needs
- Different processing models

---

### 5.2 Services

#### Chat Service

- Real-time messaging
- WebSocket communication

#### AI Service

- Chatbot (RAG)
- Recommendation engine

#### File Service

- File upload/download
- Media storage

---

### 5.3 Characteristics

- Logical separation
- Can scale independently
- Communicate via API or events

---

## 6. Event-Driven Architecture

### 6.1 Description

Modules and services communicate through events to reduce coupling.

---

### 6.2 Example Events

- class.created
- session.created
- attendance.recorded
- session.completed
- payment.triggered

---

### 6.3 Flow

1. Core module emits event
2. Other modules/services listen
3. Execute corresponding actions

---

### 6.4 Benefits

- Loose coupling
- Flexible integration
- Easier scaling

---

## 7. AI Architecture Layer

### 7.1 Chatbot (RAG)

Flow:

1. User sends question
2. Convert to embedding
3. Search knowledge base (vector DB)
4. Generate response using AI model
5. Return answer

---

### 7.2 Recommendation System

The recommendation system is designed as a **hybrid model**, combining:

- Semantic search (vector-based)
- Business logic filtering (rule-based)

⚠️ Note:

- Scoring formula is **configurable**
- Not hard-coded at architecture level

---

### 7.3 Purpose

- Personalization
- Faster matching
- Improved user experience

---

## 8. Blockchain Escrow Architecture

### 8.1 Description

EduConnect uses blockchain to implement an **escrow payment system**.

---

### 8.2 Concept

- Student deposits funds into a smart contract
- Funds are locked (escrow)
- Payment is released based on session outcome

---

### 8.3 Responsibilities

Smart contract handles:

- Holding funds
- Executing payment
- Recording transactions

Backend handles:

- Attendance evaluation
- Triggering payment
- Sending transaction requests

---

### 8.4 Payment Principle

- Payment is based on session participation
- Attendance is used as input condition
- Final distribution logic is configurable

---

## 9. Data Architecture

### 9.1 MongoDB

Used for:

- Users
- Classes
- Sessions
- Attendance
- Assignments
- Payments

---

### 9.2 Vector Database

Used for:

- AI embeddings
- Semantic search

---

### 9.3 Blockchain

Used for:

- Escrow management
- Payment execution
- Transaction logs

---

## 10. Communication Patterns

- REST API → Core logic
- WebSocket → Real-time chat
- Event Bus → Internal communication

---

## 11. System Flow Overview

### 11.1 Class Lifecycle

- Student creates request
- Tutor applies
- Match accepted
- Class is created

---

### 11.2 Learning Flow

- Tutor creates session
- Students attend
- Attendance recorded

---

### 11.3 Payment Flow

- Funds deposited to escrow
- Session completed
- Attendance evaluated
- Payment triggered

---

### 11.4 Assignment Flow

- Tutor uploads assignment
- Students submit work
- Tutor evaluates

---

### 11.5 Chat Flow

- User sends message
- Stored in database
- Broadcast in real-time

---

### 11.6 AI Flow

- User interacts with chatbot
- System retrieves knowledge
- AI generates response

---

## 12. Development Strategy

### Phase 1:

- Auth
- User
- Class

---

### Phase 2:

- Session
- Attendance

---

### Phase 3:

- Assignment
- File system

---

### Phase 4:

- Chat service

---

### Phase 5:

- AI service

---

### Phase 6:

- Payment + Blockchain

---

## 13. Key Design Principles

- Separate concerns clearly
- Avoid tight coupling
- Build core before advanced features
- Keep AI and blockchain modular
- Design for scalability

---

## 14. Conclusion

EduConnect uses a hybrid architecture that balances simplicity and scalability.

The system is designed to:

- Support complex features (AI, blockchain)
- Maintain clean modular structure
- Allow future expansion without major redesign

---

backend/
│
├── core-backend/ (NestJS - Modular Monolith)
│ │
│ ├── modules/
│ │ │
│ │ ├── auth/
│ │ │ ├── auth.controller.ts
│ │ │ ├── auth.service.ts
│ │ │ ├── auth.module.ts
│ │ │ └── jwt.strategy.ts
│ │ │
│ │ ├── user/
│ │ │ ├── user.controller.ts
│ │ │ ├── user.service.ts
│ │ │ ├── user.module.ts
│ │ │ └── schemas/
│ │ │
│ │ ├── class/
│ │ │ ├── class.controller.ts
│ │ │ ├── class.service.ts
│ │ │ ├── class.module.ts
│ │ │ ├── post/
│ │ │ ├── match-request/
│ │ │ └── classroom/
│ │ │
│ │ ├── enrollment/
│ │ │ ├── enrollment.service.ts
│ │ │ └── enrollment.module.ts
│ │ │
│ │ ├── session/
│ │ │ ├── session.controller.ts
│ │ │ ├── session.service.ts
│ │ │ ├── session.module.ts
│ │ │ ├── attendance/
│ │ │ │ ├── attendance.service.ts
│ │ │ │ └── attendance.schema.ts
│ │ │
│ │ ├── assignment/
│ │ │ ├── assignment.controller.ts
│ │ │ ├── assignment.service.ts
│ │ │ ├── submission/
│ │ │ │ ├── submission.service.ts
│ │ │ │ └── submission.schema.ts
│ │ │
│ │ ├── payment/
│ │ │ ├── payment.service.ts
│ │ │ ├── payment.module.ts
│ │ │ └── escrow.logic.ts
│ │ │
│ │ ├── contract/
│ │ │ ├── contract.service.ts
│ │ │ ├── contract.module.ts
│ │ │ └── blockchain.adapter.ts
│ │ │
│ │ └── common/
│ │ ├── decorators/
│ │ ├── guards/
│ │ ├── interceptors/
│ │ └── utils/
│ │
│ ├── database/
│ │ ├── mongodb.config.ts
│ │ └── schemas/
│ │
│ ├── events/
│ │ ├── event.module.ts
│ │ ├── event.emitter.ts
│ │ └── listeners/
│ │ ├── session.listener.ts
│ │ ├── payment.listener.ts
│ │ └── class.listener.ts
│ │
│ └── main.ts
│
├── services/
│ │
│ ├── chat-service/
│ │ ├── socket.gateway.ts
│ │ ├── chat.service.ts
│ │ ├── message.schema.ts
│ │ └── chat.module.ts
│ │
│ ├── ai-service/
│ │ ├── chatbot/
│ │ │ ├── rag.service.ts
│ │ │ ├── embedding.service.ts
│ │ │ └── prompt.template.ts
│ │ │
│ │ ├── recommendation/
│ │ │ ├── recommend.service.ts
│ │ │ └── scoring.strategy.ts
│ │ │
│ │ └── ai.module.ts
│ │
│ ├── file-service/
│ │ ├── upload.service.ts
│ │ ├── s3.adapter.ts
│ │ └── file.module.ts
│ │
│ └── blockchain-service/
│ ├── contract.service.ts
│ ├── web3.provider.ts
│ └── abi/
│
├── shared/
│ ├── constants/
│ ├── types/
│ └── utils/
│
└── config/
├── env.config.ts
└── app.config.ts
