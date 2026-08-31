# EduConnect AI Matching Baseline

## 1. Purpose

AI Matching is a supporting capability for:

- search;
- recommendation;
- ranking;
- Student/Tutor/Class matching when the product flow requires it.

AI does not replace core search, connection, contract, or learning business flows. It also does not need to appear as a standalone Use Case to be part of the system direction.

## 2. Current Status

Current implementation status: NOT_IMPLEMENTED for the AI service layer.

Current source audit did not find:

- `ai-service`;
- Qdrant container/config;
- Spring AI dependency/config;
- embedding generation;
- vector search implementation;
- LLM/RAG/chatbot implementation.

Current source does include non-AI search/filter behavior in Account/Learning features, such as tutor/class search and class filtering. These are useful inputs for future matching but are not AI Matching implementation by themselves.

## 3. Baseline Matching Strategy

### Stage 1 - Hard Filtering

Hard filters should enforce core business constraints before ranking.

Candidate criteria may include:

- subject;
- education level;
- learning mode;
- area/location;
- availability;
- price/fee.

Hard filtering should not be bypassed by AI scoring.

### Stage 2 - Weighted Ranking

After filtering, the system can rank candidates using weighted factors such as:

- subject/level fit;
- schedule fit;
- price fit;
- tutor experience;
- rating;
- profile completeness;
- textual relevance.

Do not hard-code final weights unless the user confirms the scoring design. Weights should remain configurable or easy to revise when implementation begins.

### Stage 3 - Semantic Similarity

Semantic matching is a planned enhancement:

Text -> Embedding -> Vector -> Qdrant -> Similarity Search -> Ranking.

Semantic search should enhance recommendation quality, not become a blocker for basic search/filter flows.

## 4. AI Data Sources

AI capability should not assume direct database access to another service.

Expected input domains may include:

- student profile/search intent;
- tutor profile and expertise;
- class/tutor availability;
- subject/catalog data;
- rating/feedback data when implemented.

Before implementing an AI interface, audit the owning service and decide whether data should come through API, events, or another confirmed integration pattern.

## 5. Qdrant / Spring AI

Current status:

- Qdrant: PLANNED.
- Spring AI: PLANNED.

Intended roles:

- Qdrant stores/searches vectors for semantic similarity.
- Spring AI may support embedding/model/vector-store integration.

Do not introduce a model provider, vector database, or embedding pipeline without explicit confirmation.

## 6. Fallback Behavior

If AI Matching is unavailable, basic search/filter should still work.

AI is an enhancement layer. Core business flows must remain deterministic and understandable.

## 7. Explainability

When matching is implemented, recommendation results should be explainable through business-readable factors such as subject fit, schedule fit, price fit, experience, rating, and location.

Do not require an LLM solely for explanation unless the product design confirms it.

## 8. AI Guardrails

- AI must not decide on behalf of the user.
- AI must not bypass business rules or hard filters.
- AI must not override authorization or data ownership rules.
- Do not add a new AI service/module without explicit confirmation.
- Do not call AI Matching IMPLEMENTED without source evidence for the main matching flow.
- Do not treat UI copy mentioning "AI" as implementation evidence.

## 9. Where to Audit

For AI Matching tasks, start with:

- `docs/AI_MATCHING.md`;
- current search/filter implementation in Account and Learning services;
- tutor/student/profile/class/catalog data ownership;
- `frontend-web` search/recommendation UI;
- `mobile-app` search/auth flow if mobile is in scope;
- `ai-service`, Qdrant, or Spring AI config only if those are added later.
