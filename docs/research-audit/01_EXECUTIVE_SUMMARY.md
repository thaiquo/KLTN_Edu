# EduConnect Research Audit — Executive Summary

**Audit date:** 2026-11-12 (Asia/Ho_Chi_Minh)  
**Scope:** source, configuration, tests and non-destructive runtime capability checks  
**Classification:** `FACT` unless explicitly marked otherwise

## 1. Baseline

| Item | Evidence | Result |
|---|---|---|
| Current branch | `git status --short --branch` | `community-moderation-fix`, ahead 52 commits, with 44 changed/untracked status entries before this report |
| HEAD | `git rev-parse HEAD` | `f0b9484b919f9eac7465d47555ac82f87ce43e95` |
| Intended long-lived branch | `AGENTS.md` | `feature/quocthai`; not switched because the worktree was already dirty and audit must preserve unrelated changes |
| Java | `java -version` | Java 23 available; project requires Java 21+ |
| Maven | `mvn -version` | `BLOCKED`: Maven not on PATH; service Maven Wrapper works |
| Node/npm | `node --version`, `npm --version` | Node 22.13.0 / npm 11.3.0 |
| Docker | `docker info` with 10-second timeout | `BLOCKED`: daemon did not respond |
| Database/Qdrant runtime counts | PostgreSQL/Qdrant not reachable through the available runtime | `NOT_VERIFIED`; no record counts are inferred from seed files |

## 2. Main conclusion

EduConnect uses a **Service-Based Architecture**, not a proven Microservices Architecture. The repository contains API Gateway, Account, Learning, Contract, Notification and AI services, plus React/Vite web, Expo mobile, PostgreSQL/Flyway, RabbitMQ, Qdrant and Solidity/Foundry assets. The architecture and gateway routes are evidenced by [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) and [`backend/api-gateway/src/main/resources/application.properties`](../../backend/api-gateway/src/main/resources/application.properties).

**AI Tutor Matching is currently a hybrid deterministic/semantic ranker:**

1. Gemini extracts a natural-language requirement into JSON (`/api/ai/matching/analyze`).
2. Catalog/location grounding resolves human hints against authoritative Account/Learning snapshots (`/api/ai/matching/ground`).
3. Account Search V2 supplies tutor candidates.
4. Hard eligibility removes unapproved tutors, wrong teaching mode, and tutors without the requested subject/level.
5. A deterministic weighted score ranks schedule, budget, location, experience, rating confidence and lexical specialty evidence.
6. If meaningful semantic context exists, Gemini embeddings + Qdrant are queried; validated semantic ranks add a bounded rank boost.
7. Explanations are backend rule/template text, not LLM-generated explanations.

This is **not evidence of model training, reinforcement learning, fine-tuning, or learning-to-rank**. It is an API embedding model plus deterministic heuristics and bounded rank fusion.

## 3. Formula status

Let active criteria be the criteria requested by the student, with implementation base weights:

`subjectLevel=22`, `schedule=20`, `budget=18`, `location=14`, `experience=16`, `ratingConfidence=12`, `specialty=34`.

The implementation normalizes active base weights to 100:

`w_i = round(100 * baseWeight_i / Σ baseWeight_j)` for each criterion except the final criterion, which receives the residual `100 - assignedWeight`.

`structuredScore = Σ(w_i * normalizedScore_i)`.

For semantic candidates, the Qdrant result list is converted to a rank signal:

`semanticSignal(rank i) = 1` when there is one result, otherwise `1 - i/(n-1)`.

`semanticBoost = semanticSignal * maxSemanticRankBoost`, default maximum `3.0`.

`hybridScore = structuredScore + semanticBoost`.

`matchPercentage = round(hybridScore)`, clamped to `[0,100]`.

Therefore `matchPercentage` is a bounded compatibility score, **not a probability** and not calibrated likelihood. Evidence: [`TutorMatchingService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/TutorMatchingService.java):101-107, 132-268, 280-395, 580-620, 1140-1150 and [`HybridMatchingProperties.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/HybridMatchingProperties.java):8-25.

## 4. Verification results

- AI targeted tests: **91 run, 0 failures, 0 errors, 0 skipped, exit 0**.
- Frontend targeted tests: **16 run, 0 failures, exit 0** (5 admin-operation, 4 portal-access, 7 pagination).
- Frontend production build: **exit 0**.
- Real Gateway → Account → AI → Qdrant/DB API flows: **BLOCKED** because Docker did not respond and no authenticated runtime was available.
- No benchmark, precision/recall/NDCG/MRR, latency distribution, constraint-violation rate or runtime database count is claimed.

## 5. Research readiness

**Recommended paper direction:** semantic-aware, explainable tutor retrieval/ranking under hard educational constraints.

**Readiness:** `NEEDS_EXPERIMENTS` for a source-grounded study; `NEEDS_IMPLEMENTATION` for a publishable evaluation pipeline because the repository has no ground-truth relevance labels, frozen dataset protocol, experiment runner, metric computation, or production telemetry sufficient for scientific claims.

## 6. Highest-priority gaps

1. Freeze a versioned tutor/candidate dataset and relevance-labeling protocol.
2. Capture query, candidate, constraints, rank output, explanation and latency without PII.
3. Implement reproducible offline evaluation for Precision@K, Recall@K, NDCG@K, MRR, latency and hard-constraint violations.
4. Compare manual structured search, lexical heuristic, semantic retrieval and hybrid ranking.
5. Run ablations for semantic boost, specialty evidence, schedule and budget components.
6. Verify real Qdrant collection state and runtime API behavior with a non-destructive test account.
