# EduConnect Implementation Status

> Post-merge baseline: 2026-10-10. Status describes current source evidence and recent merge validation, not production readiness. `IMPLEMENTED` means the main flow has source evidence; use explicit validation notes for tests/runtime.

## 1. Status Legend

| Status | Meaning |
| --- | --- |
| `IMPLEMENTED` | Main flow exists with controller/service/persistence/security/client evidence where relevant. |
| `IMPLEMENTED + TESTED` | Implemented and covered by the noted automated validation. |
| `PARTIAL` | Real parts exist, but important workflow/runtime coverage remains incomplete. |
| `NEEDS VALIDATION` | Source suggests the flow exists, but post-merge runtime verification is still pending. |
| `PLANNED` | Not implemented as current runtime behavior. |

## 2. Service Summary

| Service | Status | Notes |
| --- | --- | --- |
| `api-gateway` | IMPLEMENTED | Routes current REST and WebSocket families with credentialed CORS/cookie forwarding. |
| `account-service` | IMPLEMENTED + TESTED | Auth, roles, active role, Student/Tutor profiles, Tutor application identity data and internal notification recipient lookup. Full suite: 151 PASS. |
| `learning-service` | IMPLEMENTED + TESTED | Catalog, tutor authorization/registrations, availability, classes, enrollment, sessions, attendance, homework, reviews, Community, Tutor Follow, public share UUIDs and Learning termination sync. Compact Flyway V1..V11; full suite: 201 PASS. |
| `contract-service` | IMPLEMENTED/PARTIAL | Contract, signing, final PDF/artifacts, escrow, settlement, dispute, termination governance/outbox and blockchain reconciliation are implemented; production ops remains limited. Contract V17..V19 cover termination governance/outbox/classification. |
| `notification-service` | IMPLEMENTED + TESTED | Persisted Bell notifications, event consumers, human chat REST/WebSocket, media attachments and structured Class/Post cards. Full suite: 74 PASS. |
| `ai-service` | IMPLEMENTED/PARTIAL | Tutor/Class AI Matching, Gemini analyzer/grounding, Qdrant semantic retrieval, Matching V3 explainability and chatbot RAG/tools are implemented. Full suite: 220 PASS + 4 external-runtime smoke tests skipped. |
| `frontend-web` | IMPLEMENTED/PARTIAL | Marketplaces, portal/dashboard, Community, contracts/termination/refund, human Messages with resource cards and shared AI chatbot widget. TypeScript and production build PASS. |
| `mobile-app` | PARTIAL | Basic auth/home exists; no Web feature parity. |

## 3. Actor Use Cases

| Area | Web | Backend | Mobile | Notes |
| --- | --- | --- | --- | --- |
| Registration/login/session | IMPLEMENTED | IMPLEMENTED | PARTIAL | Cookie JWT, refresh, logout/revoke. |
| Role switching/activeRole | IMPLEMENTED | IMPLEMENTED | PARTIAL | Tutor role eligibility requires approved Tutor state. |
| Tutor Search | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Manual marketplace and public Tutor Detail V2. |
| Class Search | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Manual public class search/detail/share and marketplace UI. |
| Tutor AI Matching | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Integrated into Tutor Marketplace/chatbot; no standalone `/matching` route. |
| Class AI Matching | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Integrated into Class Marketplace/chatbot; post-merge runtime regression pending. |
| Matching V3 explainability | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Dynamic scoring, score breakdown, reasons/mismatch reasons in AI Service contracts. |
| Community Posts | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Feed/list/detail/create/update/delete/close, Student/Tutor post types. |
| Tutor Follow | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Student-to-approved-Tutor follow, follower count, followed-Tutor feed filter and management views. |
| Polls/interactions/bookmarks | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Poll voting, likes, comments/replies, bookmarks. |
| Community notifications | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Learning emits Community events; Notification consumes supported events. |
| Community post-to-class | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Tutor-author conversion uses class creation behavior. |
| Human messaging | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Student-Tutor direct chat, REST/WebSocket, image/video attachments. |
| Bell notifications | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Persistent notification list/count/read and WebSocket. |
| Tutor application/approval | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Account-owned identity evidence and Staff review. |
| Tutor teaching registration approval | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Learning-owned catalog/teaching authorization review. |
| Class enrollment | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Student request, Tutor accept/reject, activation after contract funding. |
| Sessions/attendance/homework | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Rolling sessions, independent attendance, gated homework files/submissions. |
| Tutor/Class reviews | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Student review eligibility tied to learning completion. |
| Contract signing/payment/escrow | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | EIP-712, payment submission, blockchain event-driven activation. |
| Contract termination governance/outbox | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Contract-owned; Learning sync and Notification delivery implemented. |
| Wallet/refund/financial views | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED | Role-scoped financial/termination refund state display. |
| Violation/support ticket | PLANNED | PLANNED | PLANNED | No complete domain module. |
| Mobile parity | PARTIAL | N/A | PARTIAL | Needs dedicated implementation. |

## 4. Account and Security

- IMPLEMENTED: register, verify/resend OTP, login, refresh, switch role, logout, forgot/reset password.
- IMPLEMENTED: short-lived access token cookie and refresh cookie; CSRF handling for browser mutation requests.
- IMPLEMENTED: multi-role account model with `activeRole`.
- IMPLEMENTED: Student/Tutor profile, avatar, password and wallet update.
- IMPLEMENTED: Tutor application identity evidence and Staff approval.
- IMPLEMENTED + TESTED: internal active Staff/Admin notification recipient lookup for Contract termination notifications; requires scoped service JWT.

## 5. Learning

- IMPLEMENTED: compact Flyway V1..V11, with Community in V8, Tutor Follow in V9, tutor-profile normalization in V10 and public share UUIDs in V11.
- IMPLEMENTED: teaching catalog, tutor subject registrations, subject suggestions/requests and review flows.
- IMPLEMENTED: Tutor availability and class creation/review/visibility.
- IMPLEMENTED: public class search/detail/share endpoints, including UUID-based shared class resolution.
- IMPLEMENTED: enrollment request lifecycle and Contract-driven activation/expiration.
- IMPLEMENTED: rolling sessions, attendance, meeting-link gate, homework assignment/submission, classroom materials and syllabus files.
- IMPLEMENTED: tutor/class reviews and public rating summaries.
- IMPLEMENTED: Community posts, polls, interactions, bookmarks, comments/replies, class suggestions and post-to-class conversion.
- IMPLEMENTED: Learning-side termination hold/cutoff sync. Contract remains the decision owner.

## 6. Contract, Blockchain and Documents

- IMPLEMENTED: contract initiation, signatures, agreement state, document view/artifact and final PDF retention.
- IMPLEMENTED: payment submission records funding transaction and waits for confirmed blockchain event before activation.
- IMPLEMENTED: settlement, payout/refund, dispute/evidence and transaction recovery pipeline.
- IMPLEMENTED: termination governance, role-scoped cases/refunds, evidence, response/action handling, Contract -> Learning synchronization and termination notification outbox.
- IMPLEMENTED: current blockchain/escrow reconciliation patterns; successful Sepolia evidence exists in project history, but post-merge runtime replay is not implied by this status file.
- PARTIAL: production blockchain ops such as multi-RPC failover, monitoring and signer HA remain future hardening.

## 7. Notification and Human Messaging

- IMPLEMENTED + TESTED: Bell notification persistence, list/count/read APIs and WebSocket delivery for supported events.
- IMPLEMENTED + TESTED: Rabbit consumers for Account, Learning, Community and Contract notification paths covered by current tests.
- IMPLEMENTED: human Student-Tutor direct conversations, participant authorization, text/media messages, structured class/post share cards, unread/read state and `/ws/chat`.
- IMPLEMENTED: chat Bell behavior with Messages-view context suppression.
- NOT IMPLEMENTED: calls, typing/presence and mobile chat parity.

## 8. AI Matching and Chatbot

- IMPLEMENTED: Tutor AI Analyze -> Ground -> Match.
- IMPLEMENTED: Class AI Analyze -> Ground -> Match.
- IMPLEMENTED: Gemini Natural Language Requirement Analyzer for structured Vietnamese learning/class requirements.
- IMPLEMENTED: Catalog and offline location grounding.
- IMPLEMENTED: Qdrant vector store, tutor capability indexing, public class indexing and semantic candidate retrieval.
- IMPLEMENTED: Matching V3 explainable dynamic scoring with score breakdown, matching reasons and mismatch reasons.
- IMPLEMENTED: chatbot foundation through `POST /api/ai/chat`, shared global Web widget, RAG knowledge index, public Tutor/Class lookup/count tools, public Tutor/Class matching tools and authenticated Student/Tutor read-only tools.
- NEEDS VALIDATION: post-merge end-to-end browser/runtime regression for chatbot and AI Matching should be rerun after dist cleanup/service restart.
- NOT IMPLEMENTED: do not document separate services for chatbot/matching or a standalone `/matching` route.

## 9. Frontend

- IMPLEMENTED: Tutor Marketplace manual search, Tutor Detail V2, AI Tutor Matching modal/results and session persistence.
- IMPLEMENTED: Class Marketplace manual search, public class detail/share, AI Class Matching results and session persistence.
- IMPLEMENTED: Community feed/management, poll voting, comments, likes/bookmarks and post-to-class flow.
- IMPLEMENTED: Student/Tutor/Staff/Admin portal flows for current class, contract, termination and refund surfaces.
- IMPLEMENTED: human Messages UI using real Notification chat APIs, including dynamically resolved class/post share cards.
- IMPLEMENTED: shared global AI chatbot widget.
- MERGE-FIX-C validation: frontend source integration PASS, utility tests 11 PASS, `npm run build` PASS.

## 10. Current Post-Merge Validation

| Phase | Validation |
| --- | --- |
| MERGE-FIX-A | Learning event integration PASS; Notification event integration PASS; Learning 183 tests PASS; Notification 73 tests PASS; Account internal recipient 3 tests PASS. |
| MERGE-FIX-B | Learning compact Flyway V1..V8; clean DB migration PASS; JPA validate PASS; Learning 183 tests PASS. Follow extends the compact lineage with V9. |
| MERGE-FIX-C | Frontend source integration PASS; utility tests 11 PASS; frontend build PASS. |
| FULL REGRESSION 2026-10-10 | Account 151 PASS; Gateway 1 PASS; Contract 206 PASS + 7 skipped; Learning 201 PASS; Notification 74 PASS; AI 220 PASS + 4 external-runtime smoke tests skipped; frontend TypeScript/build PASS. |

These are merge validations, not a blanket full production end-to-end certification.

## 11. Planned / Remaining Work

1. Restart all services after the merge and run authenticated browser/runtime smoke tests for structured sharing, Community, termination/refund notifications, AI Matching and chatbot.
2. Run the four skipped Gemini/external-runtime AI smoke tests with required credentials and dependencies.
3. Improve mobile parity for auth, classes, contracts, messages and AI flows.
4. Add full violation/support ticket and reporting suite if required.
5. Continue production operations hardening for blockchain, observability, backups and multi-RPC behavior.

## 12. Documentation Rule

When source changes, update this file only with evidence from controller/service/persistence/security/client/tests/runtime as appropriate. Do not mark a feature `IMPLEMENTED` because a name appears in code, a mock UI exists, or a future plan mentions it.
