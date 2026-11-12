# AI Matching Technical Audit

## 1. Endpoint and controller evidence

| Endpoint | Controller | Behavior |
|---|---|---|
| `POST /api/ai/matching/analyze` | [`RequirementAnalysisController.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/controller/RequirementAnalysisController.java):12-24 | Gemini extraction followed by normalization and required-field status |
| `POST /api/ai/matching/ground` | [`RequirementGroundingController.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/controller/RequirementGroundingController.java):12-24 | Catalog/location grounding and clarification |
| `POST /api/ai/matching/tutors` | [`TutorMatchingController.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/controller/TutorMatchingController.java):11-23 | Candidate retrieval, eligibility, scoring, optional hybrid ranking |
| `POST /api/ai/semantic/search` equivalent service route | [`SemanticIndexController.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/controller/SemanticIndexController.java):44-76 | Staff/Admin semantic maintenance/search surface |

## 2. NLP extraction and grounding

**FACT:** Gemini is configured for JSON response mode, temperature 0, explicit extraction-only instructions, no invented IDs/rankings, and malformed/empty response errors in [`GeminiService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/GeminiService.java):103-145 and its analysis instruction near lines 45-70.

**FACT:** [`NaturalLanguageRequirementAnalyzer.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/NaturalLanguageRequirementAnalyzer.java):26-61 returns `INVALID` when `tutorSearchRelevant` is false, otherwise normalizes budget, schedules, lists and required subject/level/mode. It caps text at 400 characters, list items at 120 characters and list size at 12.

**FACT:** [`CatalogGroundingService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/CatalogGroundingService.java):35-88 resolves subject/level against a Learning snapshot and location against Account data; it returns clarification rather than inventing catalog IDs.

## 3. Candidate generation and hard constraints

[`AccountTutorSearchClient.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/client/AccountTutorSearchClient.java):34-58 calls `/api/tutors/search-v2` with subject ID, level ID, teaching mode, page, size 50 and deterministic name sort, fetching all response pages.

[`TutorMatchingService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/TutorMatchingService.java):132-141 removes candidates unless:

1. the candidate has an approved/verified flag;
2. the candidate supports the requested teaching mode;
3. an approved capability matches the requested subject and level.

This means semantic similarity cannot bypass those checks: [`StudentSemanticSearchService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/semantic/StudentSemanticSearchService.java):118-151 validates semantic hits against authoritative candidates, subject/level, teaching mode and capability ID.

**Edge-case interpretation from source:**

- Wrong subject or level: excluded.
- Unapproved tutor: excluded.
- Online/offline mismatch: excluded.
- No schedule overlap: candidate remains eligible with a zero schedule score; this is a soft penalty, not a hard constraint.
- Budget outside range: candidate remains eligible with 0.70/0.45/0.20/0.05 depending on gap; budget is soft.
- Unapproved catalog subject: grounding does not resolve it, so matching cannot start.
- “Toán hình học” versus “Toán”: exact catalog grounding can resolve a subject prefix/topic, while specialty lexical evidence depends on normalized token overlap; no dedicated mathematical ontology is evidenced.

## 4. Implemented scoring formula

### 4.1 Active weighted criteria

The constants are in [`TutorMatchingService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/TutorMatchingService.java):44-50:

| Criterion | Base weight | Activation |
|---|---:|---|
| Subject/level | 22 | Always after hard eligibility |
| Schedule | 20 | Student supplied schedules |
| Budget | 18 | Student supplied min/max |
| Location | 14 | Offline plus province |
| Experience | 16 | Text preference contains experience intent |
| Rating confidence | 12 | Text preference contains rating/review intent |
| Specialty | 34 | Learning goal, weak topics or tutor preferences produce semantic context |

The implementation excludes inactive criteria from the denominator, then normalizes active base weights to 100 in [`score`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/TutorMatchingService.java):550-604.

### 4.2 Component formulas

- **Schedule:** for each requested slot, select the maximum availability score and average over requested slots. Exact containment = `1.0`; partial overlap = `clamp(0.75 * overlapMinutes / requestedMinutes)`; day-only = `0.80`; time-of-day overlap = `1.0`; no overlap = `0.0`. Evidence: lines 604-670.
- **Budget:** overlapping ranges score `0.85 + 0.15 * requested-range coverage`, clamped to `[0.85,1]`; non-overlap scores `0.70`, `0.45`, `0.20` or `0.05` by gap ratio thresholds 0.10, 0.25 and 0.50. Evidence: lines 422-480.
- **Location:** same commune `1.0`; same province `0.75` when commune was requested or `0.85` otherwise; outside province `0.15`; missing location `0.40`. Evidence: lines 672-705.
- **Experience:** with minimum requested, `clamp(experience/minimum)`; otherwise relative to max candidate experience; missing data `0.50`. Evidence: lines 707-737.
- **Rating confidence:** with reviews, adjusted rating is `((rating*reviews)+(4.2*5))/(reviews+5)` and normalized as `clamp((adjusted-3)/2)`; absent reviews `0.58`. Evidence: lines 739-759.
- **Specialty lexical score:** normalized token overlap for weak topics (weight 6), goal (weight 3) and preferences (weight 2). No matches default to `0.55`; ratio >= 0.60 yields `0.92`; otherwise `0.62 + 0.28*ratio`. Evidence: lines 761-820.

### 4.3 Semantic retrieval and fusion

Embedding configuration is Gemini `gemini-embedding-2`, dimension 768, Qdrant collection `tutor_capabilities_v1`, cosine distance and top-K default 20 in [`application.properties`](../../backend/ai-service/src/main/resources/application.properties):15-34 and [`QdrantSemanticVectorStore.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/semantic/QdrantSemanticVectorStore.java):90-111, 145-177.

The semantic query is only applicable when learning goal, weak topics or tutor preferences exist; hard scope requires subject ID, level ID and mode. Qdrant is asked for `max(topK, 3*topK)` candidates, then authoritative validation deduplicates by tutor and truncates to requested top-K: [`StudentSemanticSearchService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/semantic/StudentSemanticSearchService.java):44-104, 118-151.

The matching service does **not** use raw cosine values as percentages. It converts result position to a normalized rank and applies a bounded boost:

`rankSignal = 1` if `n=1`, else `1 - index/(n-1)`  
`boost = rankSignal * maxSemanticRankBoost`  
`hybridScore = structuredScore + boost`

Evidence: [`TutorMatchingService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/TutorMatchingService.java):280-395 and [`HybridMatchingProperties.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/HybridMatchingProperties.java):8-25.

**Important semantic limitation:** the specialty criterion may use semantic presence as `max(lexicalScore, 0.82 + 0.18*semanticSignal)`, but the final rank boost is independent. This is a deterministic rank fusion policy, not trained hybrid ranking.

## 5. Explainability

`matchingReasons` and `mismatchReasons` are rule/template strings created by `buildExplanation`, based on criterion values, availability, profile terms, experience, location, budget and ratings: [`TutorMatchingService.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/service/TutorMatchingService.java):850-980.

They are therefore **post-hoc deterministic explanations of the implemented score**, not Gemini-generated rationales. The response exposes `scoreBreakdown`, criterion contributions, weights, missing data and semantic policy through [`TutorMatchingDtos.java`](../../backend/ai-service/src/main/java/iuh/fit/ai_service/dto/TutorMatchingDtos.java):112-205.

## 6. What is not evidenced

| Technique | Finding |
|---|---|
| Supervised ML training | `NOT_IMPLEMENTED`: no training pipeline, labels, model artifact or fit call found |
| Reinforcement learning | `NOT_IMPLEMENTED` |
| Learning-to-rank | `NOT_IMPLEMENTED`; rank is comparator + heuristic boost |
| Fine-tuning | `NOT_IMPLEMENTED`; Gemini API is called as external provider |
| Feedback loop | `NOT_VERIFIED`; reviews exist as ranking input but no relevance-learning loop |
| Probability calibration | `NOT_IMPLEMENTED`; `matchPercentage` is rounded compatibility score |

## 7. Unit-test evidence

The targeted suite covered eligibility, budget, schedule, experience, semantic validation and grounding. Command and result are recorded in [`05_TEST_AND_RUNTIME_EVIDENCE.md`](05_TEST_AND_RUNTIME_EVIDENCE.md).
