# Data and Experiment Readiness

## 1. Source-level data inventory

| Data | Source evidence | Role in matching | Runtime count |
|---|---|---|---|
| Student account/profile | Account `Student`, `User` entities under `backend/account-service/src/main/java/.../entity` | Auth context and optional profile location | `NOT_VERIFIED` |
| Tutor profile/application/status | Account `Tutor`, `TutorApplication`, `TutorProfile` entities | Approved/verified eligibility, bio and location | `NOT_VERIFIED` |
| Subject/level/catalog | Learning `V3__teaching_catalog_schema.sql`, `V4__teaching_catalog_reference_data.sql` | Grounding and hard subject/level scope | `NOT_VERIFIED` |
| Tutor subject registration/capability | Learning tutor DTOs/services and Account search contract | Capability, tuition, experience, description | `NOT_VERIFIED` |
| Availability | Learning tutor availability APIs/entities and AI `AvailabilitySlot` DTO | Schedule score | `NOT_VERIFIED` |
| Reviews/ratings | Learning `V7__reviews_schema.sql`; Account rating-summary client | Optional rating confidence score | `NOT_VERIFIED` |
| Learning request/intent | Request DTOs and Gemini extraction response | Query features; no persisted experiment dataset evidenced | `NOT_VERIFIED` |
| Feedback/relevance labels | No label table or evaluation pipeline found in inspected scope | Required for scientific ranking evaluation | `NOT_IMPLEMENTED` |
| Semantic index | Qdrant payload contains public capability metadata, model/dimension/hash/version | Retrieval index, not source of truth | `BLOCKED` |

## 2. Development, seed and user data

`backend/account-service/src/main/resources/db/dev-data/development_users.sql` and `backend/learning-service/src/main/resources/db/dev-data/development_learning.sql` are development fixtures. They must be treated as synthetic/development data unless a runtime provenance check proves otherwise. Flyway migrations define schema, but they do not prove the number of production records.

No live PostgreSQL query was run because Docker daemon verification timed out. Consequently this audit intentionally reports no tutor/student/subject/availability/review/Qdrant point count.

## 3. Ground truth and labels

No source evidence was found for:

- query-to-tutor relevance judgments;
- accepted/rejected recommendation outcomes as labels;
- click, contact, enrollment or contract conversion logs connected to a query;
- assessor agreement or labeling instructions;
- train/test split or temporal holdout;
- offline evaluator for ranking metrics.

This makes scientific claims about ranking quality currently `NEEDS_IMPLEMENTATION`.

## 4. Proposed reproducible dataset protocol

**PROPOSAL — not implemented:**

1. Export a privacy-minimized snapshot containing query text or structured intent, active constraints, tutor capability snapshot, availability, price range, rating summary and returned candidates.
2. Remove names, emails, addresses, wallet IDs, KYC, contract text and free-form private messages; retain stable pseudonymous IDs.
3. Freeze catalog/version, embedding model/version, score configuration and Qdrant snapshot.
4. Sample queries across subject, level, Online/Offline, budget, schedule, explicit weak topic and ambiguity strata.
5. Label each query-tutor pair using three annotators: `relevant`, `partially_relevant`, `not_relevant`, plus hard-constraint violation flags. Resolve disagreements with adjudication and report agreement.
6. Split by query and time, not by duplicated tutor rows; use a final untouched test set.

## 5. Metrics to add

For each query:

- `Precision@K = relevant returned in top K / K`
- `Recall@K = relevant returned in top K / all relevant`
- `NDCG@K` using graded labels (`not=0`, `partial=1`, `relevant=2`)
- `MRR = 1 / rank(first relevant)`; zero when none is relevant
- median and p95 end-to-end latency, plus Gemini and Qdrant component latency
- hard-constraint violation rate (must be zero for approved status, subject/level and mode)
- empty-result rate and fallback rate
- explanation faithfulness: whether each displayed reason is supported by the score component/data

These are experiment requirements, not measured results.

## 6. Bias, leakage and cold-start

| Risk | Evidence-based assessment |
|---|---|
| Cold-start tutor | Missing semantic point or missing reviews/availability receives fallback behavior; no empirical rate available |
| Cold-start query | Missing goal/topics/preferences disables semantic retrieval; structured score remains |
| Popularity bias | Rating confidence and review count can affect order when rating is requested; no bias audit exists |
| Geographic bias | Offline location score rewards same commune/province; this is intended policy but requires fairness analysis |
| Data leakage | Index payload is public capability metadata; no split discipline or snapshot protocol is implemented, so offline leakage remains possible |
| Catalog mismatch | Grounding is catalog-bound; topic-specific phrases may become lexical evidence rather than structured subject constraints |
| Availability mismatch | No overlap is a soft zero score, not exclusion; this can return a tutor who cannot meet a mandatory schedule |

## 7. Ablation plan

Compare:

1. Manual Account Search V2 baseline.
2. Structured deterministic score without specialty.
3. Structured score with lexical specialty.
4. Semantic retrieval alone after hard validation.
5. Current hybrid rank boost.
6. Current hybrid without rank boost.
7. Variants with schedule/budget treated as hard constraints.

Report per-stratum metrics and confidence intervals via query-level bootstrap. Do not compare only aggregate mean percentages.

## 8. Readiness

**Current:** `NEEDS_EXPERIMENTS` for a paper based on the implemented system; `NEEDS_IMPLEMENTATION` for reproducible evaluation infrastructure. There is enough source evidence to define the method, but not enough data evidence to claim effectiveness.
