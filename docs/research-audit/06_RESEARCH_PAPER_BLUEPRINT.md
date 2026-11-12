# IEEE Research Paper Blueprint

## Recommended topic

**Explainable hybrid tutor retrieval under hard educational constraints: a service-based implementation using structured eligibility, lexical evidence and semantic rank fusion.**

**Readiness:** `NEEDS_EXPERIMENTS` (method exists in source); `NEEDS_IMPLEMENTATION` (evaluation and telemetry do not).

## Draft abstract

EduConnect is a web-based tutoring platform in which a natural-language learning request must be mapped to tutors satisfying educational and delivery constraints. This study investigates an explainable hybrid retrieval pipeline that first grounds student intent against authoritative subject, level and location catalogs, applies deterministic eligibility constraints, computes a dynamic weighted compatibility score over schedule, budget, location, experience, rating confidence and specialty evidence, and optionally adds a bounded semantic rank boost from embedding retrieval. Unlike claims based only on the presence of an LLM or vector database, the implementation is analyzed as an external embedding service combined with deterministic heuristics rather than a trained learning-to-rank model. The planned evaluation compares manual search, structured scoring, lexical specialty matching, semantic retrieval and hybrid fusion using query-level relevance judgments and hard-constraint violation metrics. Runtime verification is separated from source verification, and no effectiveness claim is made until the dataset, labels and reproducible evaluation are available.

## 1. Candidate research topics

| Topic | Gap | RQ1-RQ3 | Hypotheses | Status |
|---|---|---|---|---|
| **T1 — Explainable hybrid tutor retrieval** | Educational matching combines hard constraints and semantic intent, but current implementation lacks measured trade-offs | RQ1: Does semantic rank fusion improve NDCG/MRR over structured scoring? RQ2: Does it preserve zero hard-constraint violations? RQ3: Are rule explanations faithful and useful? | H1 hybrid > structured on NDCG/MRR; H2 hard violations remain zero; H3 explanations improve assessor agreement | **Recommended; NEEDS_EXPERIMENTS** |
| T2 — Grounded Vietnamese requirement extraction for tutor search | Natural-language extraction may fail on ambiguity, synonyms and catalog mismatch | RQ1 extraction accuracy? RQ2 grounding accuracy? RQ3 clarification reduction versus direct manual form? | H1 grounding reduces invalid IDs; H2 clarification improves task success; H3 errors concentrate in topic/level ambiguity | **NEEDS_EXPERIMENTS** |
| T3 — Constraint-aware search architecture for education platforms | Service boundaries, vector indexes and authoritative validation affect reproducibility and safety | RQ1 latency/reliability cost? RQ2 fallback behavior under Qdrant/Gemini failure? RQ3 which constraints should be hard? | H1 validated hybrid has lower violation rate; H2 fallback preserves availability; H3 hard schedule policy changes relevance/coverage trade-off | **NEEDS_IMPLEMENTATION** |

T1 is selected because the repository contains enough implemented scoring and semantic behavior to define an exact method, while T2/T3 require more new instrumentation and task-level evaluation.

## 2. Method to describe

Use the formulas and pseudocode in [`03_AI_MATCHING_TECHNICAL_AUDIT.md`](03_AI_MATCHING_TECHNICAL_AUDIT.md), not a newly invented algorithm. Core pseudocode:

```text
intent = GeminiExtract(message)
grounded = GroundAgainstCatalogAndLocation(intent)
if grounded lacks subject, level or mode: ask clarification
candidates = AccountSearchV2(subject, level, mode)
eligible = [c for c in candidates if approved(c)
            and mode_supported(c)
            and capability_matches(c, subject, level)]
structured = score_active_criteria(eligible, grounded)
if semantic_context(grounded):
    hits = QdrantSearch(embed(query), hard_payload_filter, 3 * K)
    validated = authoritative_validate_and_deduplicate(hits, eligible)
    structured = add_bounded_rank_boost(structured, validated)
return sort(hybrid_score, structured_score, semantic_signal,
            rating, review_count, tutor_id)
```

## 3. Baselines and datasets

- Baseline B0: Account manual search result order.
- Baseline B1: hard eligibility + subject/level only.
- Baseline B2: current dynamic structured score without semantic retrieval.
- Baseline B3: lexical specialty score.
- Treatment T1: current semantic validated rank boost.
- Treatment T2: current hybrid score with semantic specialty evidence.

Dataset: versioned, privacy-minimized query/tutor snapshot with catalog and availability snapshots. Label protocol and split rules are specified in [`04_DATA_AND_EXPERIMENT_READINESS.md`](04_DATA_AND_EXPERIMENT_READINESS.md).

## 4. Metrics and ablations

Primary: NDCG@5/10, MRR@10, Recall@10.  
Safety: hard-constraint violation rate, approved-status violation rate, empty-result rate.  
Operational: p50/p95 latency, Gemini failure/fallback rate, Qdrant failure/fallback rate.  
Explainability: reason support accuracy and assessor usefulness/agreement.

Ablate semantic retrieval, rank boost, lexical specialty, schedule, budget, location, rating and dynamic denominator. Report query-stratified confidence intervals.

## 5. IEEE six-part structure

1. **Introduction:** tutoring discovery problem, constraint/sparsity challenge, contributions and research questions.
2. **Related Work:** educational recommender systems, information retrieval, hybrid retrieval, explainable recommendation, LLM extraction.
3. **Theoretical Background:** hard eligibility, graded relevance, dynamic weighted scoring, cosine retrieval, rank fusion, NDCG/MRR.
4. **Proposed Method:** exact EduConnect pipeline, contracts, fallback behavior and explanation generation.
5. **Experiments:** dataset/labels, baselines, metrics, ablations, runtime setup and threats to validity.
6. **Conclusion:** evidence-backed findings only; limitations and next work.

## 6. Planned tables and figures

1. System architecture and ownership diagram.
2. Analyze → Ground → Retrieve → Rank → Explain sequence diagram.
3. Candidate funnel: retrieved, hard-eligible, semantically validated, returned.
4. Formula/weight table with active-denominator examples.
5. Dataset strata and label distribution.
6. Baseline metric table.
7. Ablation metric table.
8. NDCG/MRR by query stratum.
9. p50/p95 latency breakdown.
10. Constraint-violation and fallback-rate chart.
11. Explanation faithfulness/error taxonomy.
12. Failure-case examples: topic mismatch, no schedule, budget gap, empty catalog grounding.

## 7. Contributions already present versus required

**Already present (`VERIFIED_SOURCE`):** service boundary, natural-language JSON extraction, catalog grounding, authoritative hard eligibility, dynamic weighted scoring, lexical specialty, Gemini embeddings, Qdrant cosine retrieval, semantic validation, bounded rank fusion, deterministic explanations and fallback to structured ranking.

**Required before publication (`PROPOSAL`):** frozen dataset, labels, evaluator, experiment runner, telemetry, reproducibility manifest, statistical analysis, ablation execution and real runtime evidence.

## 8. Threats to validity

External validity is limited by one platform, one language/domain, potentially synthetic development data and a single embedding provider. Internal validity is threatened by changing catalogs, availability and Qdrant indexes. Construct validity is threatened if `matchPercentage` is interpreted as probability. Reproducibility is threatened by external Gemini availability and absent versioned experiment artifacts.
