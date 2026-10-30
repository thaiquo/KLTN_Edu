# EduConnect Implementation Status

> Post-merge baseline updated: 2026-10-30. Status describes current source evidence and production runtime validation. `IMPLEMENTED` means the main flow has source evidence; use explicit validation notes for tests/runtime.

> **Development branch convention (user-confirmed 2026-10-30):** use the long-lived branch `feature/quocthai` for subsequent work. Synchronize it from `origin/main`, push normal changes there, and merge to protected `main` through Pull Requests. Do not create additional task branches unless the user explicitly requests one. See `/AGENTS.md` for the operational rules.

> **Production deployment note (2026-10-29):** PR #8 merged to `main` at `a1a1bdd`. CI 16/16 pass. 7 images deployed. VPS production running 12/12 containers with HTTP 200 smoke test. Release `RELEASE_TAG=a1a1bddd5ab2e8452ac897a0118ec394d104420a` verified directly on VPS. Cờ an toàn `ESCROW_TRIAL_ENABLED=false` và `TUTOR_ABSENCE_GOVERNANCE_MODE=SHADOW` tiếp tục được duy trì. Flyway V18 (`command inbox class cancelled`) đã áp dụng thành công trên production PostgreSQL (`installed_rank: 18`, `success=true`). Cơ chế xử lý dừng học sau trải nghiệm (Trial Opt-Out / Cooling-Off) đã được hoàn thiện trong source: tự động hủy lớp, hủy các buổi học tương lai và đơn đăng ký chờ khi học viên cuối cùng rút lui; kết quả command được lưu bền vững vào inbox để replay lũy đẳng; `activateEnrollment()` và auto-cancel cùng khóa bi quan bản ghi lớp (`SELECT FOR UPDATE`). Kiểm thử backend thực thi 1081 tests: 1069 passed, 12 skipped (8 Anvil + 4 external AI runtime), 0 failures/errors. Theo service: Gateway 1/1 passed; Account 171/171; Learning 283/283; Contract 285 run, 277 passed và 8 Anvil skipped; Notification 75/75; AI 266 run, 262 passed và 4 external-runtime skipped. Frontend TypeScript và production build PASS (27.35s). Việc deploy thành công không đồng nghĩa hai feature an toàn đã được bật: trial vẫn OFF và tutor-absence vẫn SHADOW.

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
| `api-gateway` | IMPLEMENTED | Routes current REST and WebSocket families with credentialed CORS/cookie forwarding. 1 PASS. |
| `account-service` | IMPLEMENTED + TESTED | Auth, roles, active role, Student/Tutor profiles, Tutor application identity data, wallet ownership challenges, internal notification recipient lookup and Admin user control hardening. Compact Flyway V1..V3; full suite: 171 PASS. |
| `learning-service` | IMPLEMENTED + TESTED | Catalog, tutor authorization/registrations, availability, classes, enrollment, sessions, attendance, homework, reviews, Community, Tutor Follow, public share UUIDs, Community moderation/revisions, catalog subject-level mapping, absence safety and command inbox replay. Flyway V1..V18 (V18 command inbox class cancelled deployed to production); full suite: 283 PASS. |
| `contract-service` | IMPLEMENTED + VERIFIED | Contract, signing, final PDF/artifacts, escrow, settlement, dispute, termination governance/outbox, absence governance, and blockchain reconciliation are implemented; Live Sepolia Escrow V1 deposit and active agreement verified on VPS. Flyway V1..V22 (V22 tutor absence governance deployed to production); latest local full suite: 291 run, 283 passed, 8 Anvil skipped in the default environment, 0 failures/errors. |
| `notification-service` | IMPLEMENTED + TESTED | Persisted Bell notifications, event consumers, human chat REST/WebSocket, media attachments and structured Class/Post cards. Continuous Flyway V1..V6; full suite: 75 PASS. |
| `ai-service` | IMPLEMENTED + ACTIVATED | Tutor/Class AI Matching, Gemini analyzer/grounding, Qdrant semantic retrieval, Matching V3 explainability, chatbot RAG/tools, Community moderation classifier, rewrite assistant and homework feedback/lesson plan drafting; live VPS profile `ai` activated with Qdrant and Gemini. Full suite: 266 run, 262 passed, 4 external-runtime smoke tests skipped, 0 failures/errors. |
| `frontend-web` | IMPLEMENTED + VERIFIED | Marketplaces, portal/dashboard, Community, contracts/termination/refund, human Messages with resource cards and shared AI chatbot widget. TypeScript and production build PASS, 11 tests PASS. |
| `mobile-app` | PARTIAL | Milestone M3 implemented (Auth, Tutor search, AI matching, Community, Teaching Registration); Web3/escrow and full room parity pending. |
| **Current combined backend evidence** | **GREEN** | **1087 run: 1075 passed, 12 skipped, 0 failures/errors** using the latest per-service suites (Learning 283 + Contract 291 + Account 171 + Notification 75 + AI 266 + Gateway 1; skipped: 8 Anvil + 4 external-runtime). This is combined current evidence, not a claim that all six suites were rerun in one command on 2026-10-30. |

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
- IMPLEMENTED + TESTED: Admin staff user provisioning (POST /api/admin/users/staff) with system-aligned 8+ character initial password, lock/unlock for non-Admin accounts, soft delete / account deactivation (DELETE /api/admin/users/{userId}), self-lock/Admin target protection, disabled-account restore protection and immediate refresh session revocation. Staff can self-change password through `/api/users/me/password` or self-reset through forgot/reset password. 158 PASS.

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
- IMPLEMENTED (feature OFF, deployed to production): V16 trial metadata (`trial_policy_version` on `class_rooms`), canonical session 1/2 planning, schedule fingerprint and stable trial cutoff command. Cross-service schedule-mutation lock after agreement signing remains a guardrail to add if schedule editing is introduced. Legacy classrooms fallback gracefully to old progression when persisted prefix differs from canonical; trial classrooms remain fail-fast.

## 6. Contract, Blockchain and Documents

- IMPLEMENTED: contract initiation, signatures, agreement state, document view/artifact and final PDF retention.
- IMPLEMENTED: payment submission records funding transaction and waits for confirmed blockchain event before activation.
- IMPLEMENTED: settlement, payout/refund, dispute/evidence and transaction recovery pipeline.
- IMPLEMENTED: termination governance, role-scoped cases/refunds, evidence, response/action handling, Contract -> Learning synchronization and termination notification outbox.
- IMPLEMENTED + DEPLOYED IN SHADOW (ENFORCE NOT APPROVED): tutor-absence governance v1 has Learning-owned class attendance signals, immutable next-session snapshots, stable whole-class cutoff commands, two-stage expiry, probation and relapse auto-cancellation. Safety reviews corrected canary mode resolution, stale/incomplete RELEASE handling, inbox snapshot replay, legacy-session exclusion, pre-call cutoff fencing, server-authoritative UI deadlines, fake relapse snapshots, `sessionId`/`sessionSequence` conflation and notifications emitted before HOLD confirmation. PR #7 corrected missing Compose flag wiring and made an invalid non-empty allowlist fail closed to SHADOW; CI asserts resolved Compose values and `deploy/TUTOR_ABSENCE_CANARY_RUNBOOK.md` records recreate/verification/rollback steps. Production release `a1a1bdd` was directly verified with `TUTOR_ABSENCE_GOVERNANCE_MODE=SHADOW` and an empty allowlist. V22 enforces one ACTIVE probation per classroom plus governance lifecycle invariants; V17 validates snapshot/inbox shape. Learning→Contract payload and scoped service JWT contract tests pass at both sender and receiver boundaries. PostgreSQL 16 fresh and production-restore upgrade rehearsal passed; V17 and V22 are deployed. Live-process cross-service E2E, Anvil time-warp coverage, durable event-specific notification/metrics work and browser walkthrough remain gates before `ENFORCE`. See `Plan/PLAN_TUTOR_ABSENCE_GOVERNANCE.md` (frozen pre-implementation plan), `docs/TUTOR_ABSENCE_GOVERNANCE_RESULT.md` and `deploy/TUTOR_ABSENCE_CANARY_RUNBOOK.md`.
- IMPLEMENTED (feature OFF, deployed to production): V21 `agreement_trial`, signed terms v4, trial deadline worker and opt-out termination reuse exist. Late funding is quarantined from Learning activation, emits a durable incident, synchronizes cutoff 0 and enters the existing cancel/refund pipeline. V21 passed local PostgreSQL 16.15 fresh/upgrade rehearsal AND production PostgreSQL (Flyway checksum `-421953750`, success=true); late-funding on-chain E2E still required before enabling trial flag.
- IMPLEMENTED: current blockchain/escrow reconciliation patterns; successful Sepolia evidence exists in project history, but post-merge runtime replay is not implied by this status file.
- IMPLEMENTED: Contract Service multi-RPC HTTP failover ưu tiên Alchemy, chuyển sang
  endpoint dự phòng khi lỗi transport/throttle, kiểm tra chain ID và tự probe lại
  primary sau cooldown.
- IMPLEMENTED: load-aware Sepolia polling baseline (15 giây event/receipt, 90 giây
  reconciliation), catch-up theo batch logic 50 nhưng chia `eth_getLogs` thành
  request tối đa 10 block; receipt reconciliation batch 10 dùng dấu mốc
  `event_reconciled_at`, tránh lặp lại receipt đã xử lý trọn vẹn.
- PARTIAL: production blockchain monitoring and signer HA remain future hardening.

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
- IMPLEMENTED + VALIDATED: Vite reads the single repository-root `.env`; browser
  Sepolia RPC uses PublicNode so the backend Alchemy credential is not bundled
  into browser JavaScript. Production build PASS on 2026-10-14.
- MERGE-FIX-C validation: frontend source integration PASS, utility tests 11 PASS, `npm run build` PASS.

## 10. Current Post-Merge Validation

| Phase | Validation |
| --- | --- |
| MERGE-FIX-A | Learning event integration PASS; Notification event integration PASS; Learning 183 tests PASS; Notification 73 tests PASS; Account internal recipient 3 tests PASS. |
| MERGE-FIX-B | Learning compact Flyway V1..V8; clean DB migration PASS; JPA validate PASS; Learning 183 tests PASS. Follow extends the compact lineage with V9. |
| MERGE-FIX-C | Frontend source integration PASS; utility tests 11 PASS; frontend build PASS. |
| FULL REGRESSION 2026-10-10 | Account 151 PASS; Gateway 1 PASS; Contract 206 PASS + 7 skipped; Learning 201 PASS; Notification 74 PASS; AI 220 PASS + 4 external-runtime smoke tests skipped; frontend TypeScript/build PASS. |
| BLOCKCHAIN/ENV HARDENING 2026-10-14 | Contract 221 PASS + 7 Anvil tests skipped; frontend production build PASS; live Contract runtime validated chain/deployment/operator, Alchemy-primary/PublicNode-fallback setup and 50-block logical polling without observed throttle/failover errors. |
| VPS RUNTIME VALIDATION 2026-10-23 | Verified live on VPS (`103.74.100.232` / `educonnectiuh.duckdns.org`): (1) 49 accounts & 40 classes seeded, (2) JWT HttpOnly auth & role switcher verified, (3) WebSocket `/ws/chat` direct messaging verified, (4) EIP-712 dual off-chain signing (Tutor & Student via MetaMask) verified, (5) Operator on-chain agreement registration on Sepolia Escrow V1 (`0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`) confirmed at block 11977533 (Tx: [`0xe7f051...`](https://sepolia.etherscan.io/tx/0xe7f05126b92ff47aeee8466d7fead9852f753432684b4b512f07b1a3b0dcf684)), (6) Student 4.80 USDC deposit confirmed on Sepolia at block 11977570 (Tx: [`0xcbac14...`](https://sepolia.etherscan.io/tx/0xcbac14e5adf8ed03fa1e2162ea0182dbfb93ab19d3640d1d2e21aeaa21a37e4b)), transitioning agreement `2aeca99d-...` to `ACTIVE` (payment `LOCKED`) and enrollment to `ENROLLED` (Classroom #41), (7) Outbox RabbitMQ bridge patched (`SPRING_RABBITMQ_HOST: rabbitmq`), (8) AI Profile activated: all 12 containers Up including Qdrant and AI Service. |
| FULL REGRESSION & AUTO-CD 2026-10-25 | Account 171 PASS; Gateway 1 PASS; Contract 225 PASS + 7 skipped; Learning 244 PASS; Notification 75 PASS; AI 266 PASS + 4 external-runtime smoke tests skipped; frontend TypeScript/build PASS, 11 tests PASS. Total 982 backend tests PASS (0 failures, 11 skipped). Automatic CD via GitHub Actions verified live on VPS with release `b57a37c`: all 12 containers running healthy; public `/healthz` and class search API return HTTP 200. Classic Branch Protection enabled on `main` with 1 approval and `CI gate`. |
| TRIAL ESCROW DEPLOY 2026-10-27 | PR #5 merged `feature/escrow-trial-cooling-off` → `main` at `986bc3c`. CI 16/16 PASS. Workflow `Publish images` success: 7 images (account, learning, contract, notification, ai, gateway, frontend-web) published to GHCR. `Deploy VPS` job success: `educonnect-release` preflight PASS, 12/12 containers running, smoke test HTTP 200. **Production verification (direct):** (1) `ESCROW_TRIAL_ENABLED=false` confirmed in VPS `.env` and container runtime env for Learning and Contract; (2) Flyway V16 checksum `-1203505143` success=true, V21 checksum `-421953750` success=true on `educonnect-postgres-1`; (3) Legacy data intact: 41 class_rooms, 0 trial_policy_version≠null, 1 contract_agreement, 0 agreement_trial rows; (4) Off-VPS backup exported `kltn_db_prod_986bc3c.sql`, SHA-256 `E342ACE76FB272561223C4E738CB33461C5FFDFCD54F62540ACB1625776E4777`. Full backend suite at this commit: Learning 260/260, Contract 244+8Anvil, Account 171, Notification 75, AI 266+4skipped, Gateway 1. Total: 1017 PASS, 0 failures. |
| TRIAL LAST-STUDENT AUTO-CANCEL & V18 DEPLOY 2026-10-29 | PR #8 merged `feature/trial-optout-last-student-cancel` → `main` at `a1a1bdd`. CI 16/16 PASS (3m 4s). 7 images published to GHCR. Job Deploy VPS success: `educonnect-release` deployed `a1a1bdd` live to VPS behind Caddy. **Production verification (direct on VPS):** (1) `RELEASE_TAG=a1a1bddd5ab2e8452ac897a0118ec394d104420a` verified; (2) Containers `api-gateway`, `contract-service`, `learning-service` Up with image tag `a1a1bdd...`; (3) safety flags intact: `LEARNING_TRIAL=false`, `CONTRACT_TRIAL=false`, `ABSENCE_MODE=SHADOW`, `ABSENCE_IDS=`; (4) Flyway V18 (`command inbox class cancelled`) verified on production PostgreSQL with `installed_rank: 18`, `success: t`; (5) public endpoints `/healthz` and `/api/learning/public/classes?page=0&size=1` returned HTTP 200. Core logic: Contract sends individual `TRIAL_OPT_OUT` `CLOSE` with `cancelClassIfEmpty`; Learning locks `class_rooms`, cancels the target enrollment and cancels the classroom/future sessions/pending requests only when no `ENROLLED`/`ACCEPTED` student remains. V18 persists the command-specific `class_cancelled` replay result. Regression: 1081 backend tests run, 1069 passed, 12 skipped, 0 failures/errors; frontend TypeScript and production build PASS. Trial remains disabled pending concurrency/live cross-service E2E and canary. |
| STUDENT TERMINATION AFTER FIRST SESSION & DEPLOY 2026-10-30 | PR #10 merged commit `556475a` into `main` at `e19db2c`. The signed terms schema advances to `contract-terms-v5` for new agreements: Student termination opens only after the first scheduled session ends; UI and API both enforce the gate, Learning cutoff must include the completed first session, and old signed `v2`-`v4` agreements/PDF artifacts remain unchanged. Local validation: Contract 291 run, 283 passed, 8 Anvil skipped, 0 failures/errors; frontend TypeScript, utility tests and production build PASS. GitHub Actions screenshot and repository history show workflow `Publish images #11` SUCCESS in 3m42s: all six backend image jobs, Web image publish and `Deploy VPS` are green for `e19db2c`. This records successful automation; no separate direct shell verification of VPS release tag/flags/database was performed after this deploy. |

These rows are evidence records for specific commits and dates. A green deploy proves build/migration/runtime health for that release; it does not override feature-specific OFF/SHADOW flags or remaining E2E/canary gates.

## 11. Planned / Remaining Work

1. Run authenticated browser/runtime smoke tests for structured sharing, Community, termination/refund notifications.
2. Classroom #41 reached its start date (2026-10-24) with Sepolia Escrow deposit verified (4.80 USDC locked); continue monitoring weekly rolling sessions generation and attendance settlement in Vietnam business time (`Asia/Ho_Chi_Minh`).
3. Improve mobile parity for auth, classes, contracts, messages and AI flows (Milestone M3 implemented, Web3/rooms next).
4. Add full violation/support ticket and reporting suite if required.
5. Continue production operations hardening for blockchain observability, backups, multi-RPC health metrics/alerting and signer HA.
6. Deployment automation remains operational. PR #10 merged at `e19db2c` on 2026-10-30 and workflow `Publish images #11` completed all image jobs plus `Deploy VPS` successfully. The latest separate direct VPS audit remains release `a1a1bdd` on the Ubuntu VPS behind Caddy at `https://educonnectiuh.duckdns.org`, where the release tag, 12-container `--profile ai` stack, safety flags, Flyway V18 and public HTTP 200 endpoints were verified. Perform a new direct runtime audit before claiming those same details for `e19db2c`.
7. Key Architecture Separation (Clarified 2026-10-25):
   - **Blockchain Operator Wallet Key**: Configured on VPS in `/opt/educonnect/.env` as `BLOCKCHAIN_OPERATOR_PRIVATE_KEY` for Sepolia transactions (Web3j creates credentials directly). Keystore file is NOT used on the active VPS. Never placed in GitHub Actions.
   - **GitHub Actions Deployment SSH Key**: Dedicated `ed25519` key pair (`educonnect-gh-actions`). Private key stored in GitHub Secrets `VPS_SSH_KEY`, public key in VPS `~/.ssh/authorized_keys`, host fingerprint in `VPS_KNOWN_HOSTS`. Completely decoupled from Web3 wallets.
   - **Branch Protection on `main`**: Requires PR, 1 approval, and `CI gate` passing before merge. Merge automatically triggers VPS release via `/usr/local/sbin/educonnect-release`.

## 12. Documentation Rule

When source changes, update this file only with evidence from controller/service/persistence/security/client/tests/runtime as appropriate. Do not mark a feature `IMPLEMENTED` because a name appears in code, a mock UI exists, or a future plan mentions it.
