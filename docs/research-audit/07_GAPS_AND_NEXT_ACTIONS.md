# Gaps and Next Actions

## 1. Evidence gaps

| Gap | Classification | Why it matters | Next action |
|---|---|---|---|
| Docker/DB/Qdrant unavailable during audit | `BLOCKED` | No live counts, API flow or vector health | Start non-destructive local dependencies and record versions/health |
| No authenticated runtime smoke | `NOT_VERIFIED` | Cannot confirm Gateway cookies, CSRF, inter-service calls | Use a disposable Student account or approved staging account; redact data |
| No ground-truth relevance labels | `NOT_IMPLEMENTED` | Cannot claim ranking effectiveness | Define annotation guide, multi-annotator labels and adjudication |
| No evaluator/experiment runner | `NOT_IMPLEMENTED` | Metrics are not reproducible | Add an offline evaluation tool outside production path |
| Schedule mismatch is soft | `FACT` | A tutor with no overlap can still be returned | Confirm policy; if mandatory, make it hard and evaluate coverage trade-off |
| `matchPercentage` may be misread as probability | `FACT` | Scientific interpretation/calibration risk | Rename/document as compatibility score or calibrate and validate probability |
| Semantic index is derived and can be empty | `FACT` | Results depend on sync freshness | Record index version/hash and expose readiness in experiments |
| External Gemini dependency | `FACT` | Reproducibility/cost/availability risk | Cache versioned embeddings or provide a frozen benchmark embedding snapshot |
| No privacy-safe query/result telemetry | `NOT_IMPLEMENTED` | No production relevance/latency feedback | Add opt-in, minimized structured event logging |
| Worktree dirty and branch differs from convention | `FACT` | Audit baseline may not equal feature branch | Repeat audit on clean `feature/quocthai` commit before submission |

## 2. Immediate verification sequence

1. Preserve current worktree; do not reset or overwrite unrelated changes.
2. Run `feature/quocthai` from a clean checkout or worktree after user approval.
3. Start only PostgreSQL, RabbitMQ and Qdrant with non-destructive volumes.
4. Run Flyway startup and record migration versions; do not infer rows from seed files.
5. Start Account, Learning, AI and Gateway with test configuration.
6. Bootstrap CSRF, authenticate a Student, and exercise analyze → ground → match.
7. Capture six sanitized cases: clear, ambiguous, synonym, hard conflict, schedule conflict and no result.
8. Query Qdrant collection metadata/point count and record model, dimensions, distance and document version.

## 3. Experiment implementation sequence

1. Freeze a catalog/tutor/availability snapshot and pseudonymize IDs.
2. Export query cases with source and timestamp metadata.
3. Build relevance labels and report inter-annotator agreement.
4. Implement deterministic replay of B0-B3 and T1-T2.
5. Add metric computation and query-level bootstrap confidence intervals.
6. Add hard-constraint violation assertions as a safety gate.
7. Add ablation configuration with immutable weight/model/index manifests.
8. Repeat runs with Gemini/Qdrant failure injection to measure fallback behavior.
9. Review explanations against stored score contributions.
10. Only then write quantitative Results and Conclusion sections.

## 4. Claims that must not be made yet

- “The system learns from user feedback.”
- “The matching percentage is a probability.”
- “Semantic search always improves recommendation quality.”
- “The repository has production-scale tutor/student data.”
- “The AI service is fully runtime-validated.”
- “Blockchain or RAG runtime behavior was verified by this audit.”

## 5. Final readiness decision

The repository is suitable for a **method-and-evaluation design paper draft** and for implementing a controlled experiment. It is not yet evidence-complete for quantitative IEEE claims. The strongest defensible current statement is:

> EduConnect implements a source-verifiable, explainable hybrid tutor matching pipeline that combines Gemini-based requirement extraction, catalog grounding, authoritative hard eligibility, dynamic deterministic scoring, Gemini embedding retrieval through Qdrant, and bounded semantic rank fusion; targeted source tests pass, while live runtime and scientific effectiveness remain to be verified.
