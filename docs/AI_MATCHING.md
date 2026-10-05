# EduConnect — AI Matching

> Cập nhật theo source ngày **2026-09-14**.

## 1. Vai trò

AI Matching là năng lực hỗ trợ tìm kiếm, gợi ý và xếp hạng Tutor/Class phù hợp với nhu cầu Student. AI không thay thế quyền quyết định của người dùng, không vượt qua authorization và không được bỏ qua hard business filters.

## 2. Trạng thái hiện tại

Trạng thái: **PARTIAL**. `ai-service` hiện có Deterministic Matching V1, Gemini Natural Language Requirement Analyzer, Catalog Grounding, Offline Location Grounding, Tutor Marketplace frontend integration và semantic vector retrieval foundation bằng Gemini embeddings + Qdrant; chưa phải semantic/hybrid matching ranking AI hoàn chỉnh.

Đã có:

- Maven module `backend/ai-service` dùng Java 21 và Spring Boot 3.4.1;
- port mặc định 8085;
- Gateway route `/api/ai/**`;
- `GET /api/ai/health`;
- Tutor Marketplace large modal cho Student nhập nhu cầu tự nhiên, xem lại grounded requirement, trả lời clarification và xác nhận trước khi gọi Matching V1;
- Web V1 Marketplace search-session persistence qua abstraction frontend dùng `sessionStorage`: lưu tách biệt `MANUAL` filters/sort/page và `AI` result snapshot để Detail -> Back/F5 không gọi lại Gemini Analyze, Ground hoặc Matching V1 chỉ vì remount;
- Gemini provider/client thực tế cho requirement extraction;
- `POST /api/ai/matching/tutors` cho Deterministic Matching V1;
- `POST /api/ai/matching/analyze` cho Student-only natural language requirement extraction;
- `POST /api/ai/matching/ground` cho Student-only deterministic grounding từ `subjectHint`/`levelHint` sang Learning catalog IDs thật và từ `locationHint` OFFLINE sang Account administrative `provinceCode`/`communeCode` khi dữ liệu tham chiếu cho phép;
- `GET /api/reference/locations/snapshot` trong Account Service cho dữ liệu tỉnh/thành và phường/xã tham chiếu dùng bởi AI location grounding;
- structured output schema cho subject/level hints, teaching mode, budget, schedules, learning goal, weak topics và tutor preferences;
- authorization/privacy guardrails cho AI endpoints;
- Google Gemini `gemini-embedding-2` embedding runtime với 768 dimensions;
- Qdrant dev container `qdrant/qdrant:v1.18.3`, collection `tutor_capabilities_v1`, Cosine distance;
- Tutor capability semantic index foundation: một vector cho mỗi tutor subject registration + level, deterministic point ID, payload public metadata, document hash skip để tránh embedding lại khi không đổi;
- Staff/Admin protected semantic maintenance endpoints `/api/ai/semantic/**` cho init, sync, delete capability và retrieval probe;

Chưa có:

- Spring AI dependency;
- Hybrid Matching V2 dùng semantic similarity trong ranking;
- semantic recommendation/scoring service production-ready;
- RAG/chatbot persistence;
- evaluation, feedback loop, metrics hoặc safety monitoring.

Search/filter đang có trong Account/Learning là deterministic search. Matching V1 trong `ai-service` là deterministic ranking foundation. Gemini analyzer chỉ trích xuất nhu cầu học tập, không thực hiện matching và không sinh catalog IDs hoặc mã địa giới. Catalog grounding dùng Learning catalog thật để resolve subject/level IDs. Location grounding dùng Account administrative reference data thật để resolve `provinceCode`/`communeCode` cho OFFLINE, không query DB chéo service và không gọi Gemini lần hai. Frontend gọi Analyze -> Ground -> Matching theo thao tác xác nhận của Student trong Tutor Marketplace, hiển thị `matchPercentage` và `matchingReasons` thật từ Matching V1. Web hiện lưu Marketplace search session bằng `sessionStorage` adapter có version/TTL/account scope; đây là persistence phía client cho Phase 4.3, không phải Redis hay cross-device backend session.

## 3. Kiến trúc đề xuất khi triển khai

```text
Student intent
  → hard filters từ dữ liệu authoritative
  → candidate set
  → deterministic weighted scoring
  → optional semantic similarity
  → calibrated ranking + lý do giải thích
  → user tự chọn Tutor/Class
```

### Stage 1 — Hard filtering

Các điều kiện bắt buộc phải áp dụng trước AI score:

- Tutor còn hoạt động và đã `APPROVED`;
- subject/education level phù hợp;
- learning mode, khu vực và lịch rảnh;
- học phí/ngân sách;
- lớp còn nhận học viên và visibility hợp lệ.

### Stage 2 — Weighted ranking

Có thể dùng subject fit, schedule fit, price fit, kinh nghiệm, rating, hồ sơ, khoảng cách và textual relevance. Trọng số phải cấu hình/phiên bản hóa; chưa có bộ trọng số được xác nhận trong source hiện tại.

### Stage 3 — Semantic enhancement

`Text → Embedding → Vector Store → Similarity → kết hợp score`. Semantic search chỉ nâng chất lượng; nếu AI/Qdrant lỗi thì search/filter cơ bản vẫn phải hoạt động.

## 4. Data ownership

AI Service không được đọc trực tiếp bảng domain của service khác. Dữ liệu đầu vào cần được cung cấp bằng API/event/read model được thiết kế rõ:

- Account: trạng thái Tutor, profile công khai;
- Learning: subject, class, availability, capacity;
- Rating/feedback: chỉ khi domain này được triển khai và có owner;
- Student intent/profile: tối thiểu hóa dữ liệu và cần quyền sử dụng phù hợp.

Không gửi CCCD, tài liệu KYC, dispute evidence, private message hoặc dữ liệu hợp đồng nhạy cảm vào model/vector store.

## 5. Guardrails

- Không quảng bá “AI Matching đã hoạt động” chỉ vì có route/UI/health endpoint.
- Không để model quyết định duyệt Tutor, giải ngân hay phân xử khiếu nại.
- Không để LLM sinh điều kiện tài chính hoặc bypass filter.
- Kết quả cần lý do dễ hiểu và có fallback deterministic.
- Cần xác nhận model provider, chi phí, privacy, retention và Qdrant design trước khi triển khai.

## 6. Điều kiện chuyển sang IMPLEMENTED

Chỉ nâng trạng thái khi có tối thiểu: API thật, data contract với owner, hard filtering, ranking có test, client sử dụng kết quả thật, fallback, authorization/privacy và bằng chứng end-to-end. Health endpoint không đủ.

## Phase 4.4.1 Part 1 - Embedding Foundation Prepared

Selected Google Gemini `gemini-embedding-2` for Semantic V1 with `EMBEDDING_DIMENSIONS=768`. The integration reuses `GEMINI_API_KEY` through `EMBEDDING_PROVIDER=gemini`, `EMBEDDING_MODEL=gemini-embedding-2`, and `EMBEDDING_DIMENSIONS=768`. `ai-service` has an `EmbeddingService` abstraction, Gemini provider implementation, vector validation, and deterministic semantic text builders.

## Phase 4.4.2 - Qdrant Semantic Retrieval Foundation

Qdrant is configured as a derived semantic index, not a source of truth. The dev container uses `qdrant/qdrant:v1.18.3` with HTTP port `6333`, gRPC port `6334`, collection `tutor_capabilities_v1`, vector size `768`, and Cosine distance.

Tutor capability indexing uses Account Search V2 as the runtime source for public approved tutors. Each semantic point represents one tutor subject registration + level, with deterministic point IDs from `tutorId`, `registrationId`, `subjectId`, and `levelId`. Payload is limited to public/index metadata: tutor/user IDs, capability ID, subject/level IDs, teaching modes, document version, embedding model, embedding dimensions, document hash, and indexed timestamp. Vectors are never exposed by the semantic API.

The indexer compares document hash, embedding model, embedding dimensions, and document version before embedding. Unchanged points are skipped, so repeated sync does not call Gemini again for stable data. Semantic retrieval currently returns raw internal similarity hits only; it is not integrated into Matching V1, does not produce `matchPercentage`, and does not perform hybrid ranking.

## Phase 4.4.3 - Semantic Candidate Retrieval

Semantic retrieval now produces validated `SemanticTutorCandidate` records for later Hybrid Matching V2. The flow consumes already-grounded student requirements and applies a deterministic semantic applicability rule before embedding. Requests with only hard fields such as `subjectId`, `levelId`, and `teachingMode` return `NOT_APPLICABLE` and do not call Gemini embeddings.

When semantic context exists, the query builder embeds only learning-need text such as learning goal, weak topics, tutor preferences, subject context, and level context. It does not include JWT, cookies, email, phone, user IDs, exact address, KYC, contract, payment, dispute, or private chat data.

Qdrant search remains hard-scoped by `subjectId`, `levelId`, and `teachingMode`. Qdrant is still derived data, so every hit is validated against Account Search V2, which combines Account public tutor state with Learning capability data. Stale hits are rejected, duplicate capability hits are grouped by tutor, and the best valid capability is selected by highest raw semantic similarity. No arbitrary similarity threshold is applied.

`semanticSimilarity` remains raw vector similarity. It is not `matchPercentage`, is not multiplied by 100, and is not merged into Matching V1 in this phase. Matching V1 formula, frontend behavior, and tutor indexing remain unchanged.

## Phase 4.4.4 - Hybrid Matching V2 Backend

Hybrid Matching V2 now runs inside `ai-service` behind the existing `POST /api/ai/matching/tutors` contract. Matching V1 structured scoring remains the baseline: hard eligibility still comes from Account Search V2 plus Learning capability data, and V1 components remain schedule, budget, location, experience, and rating confidence.

The selected strategy is a conservative two-stage hybrid. First, V1 scores every hard-eligible tutor. Then semantic retrieval is attempted only as an enhancement. Validated semantic candidates are joined back to V1 results by `tutorId`; semantic retrieval cannot introduce a tutor that failed V1 hard eligibility.

Semantic calibration uses relative semantic rank, not raw cosine magnitude. A validated semantic candidate receives a bounded rank-based boost up to `SEMANTIC_MATCHING_MAX_RANK_BOOST` points, default `3.0`. Raw cosine similarity is never treated as a percentage and is not exposed as `matchPercentage`. Missing semantic vectors are neutral: the tutor remains eligible and receives no semantic boost, not a penalty.

Fallback behavior is explicit. If semantic matching is disabled by `SEMANTIC_MATCHING_ENABLED=false`, if semantic context is not applicable, or if Gemini embedding/Qdrant/authoritative semantic validation fails, the endpoint returns Matching V1 ordering and percentages. This preserves deterministic search/matching as the reliable baseline.

`matchPercentage` remains an EduConnect compatibility score from 0 to 100. It is not a probability, not LLM confidence, and not cosine similarity. Phase 4.4.4 does not add frontend semantic labels, raw vector display, or fact-grounded semantic explanation UX; those remain for Phase 4.4.5.

## Phase 4.4.5 - Hybrid Matching Frontend Integration

The existing Tutor Marketplace AI flow now consumes Hybrid Matching V2 transparently through the same `POST /api/ai/matching/tutors` endpoint. The Student-facing UI still has a single "Tim gia su bang AI" experience: Analyze -> Ground -> confirm -> Matching. There is no separate Semantic/Qdrant mode, tab, or endpoint in the frontend.

The Marketplace cards continue to show the final `matchPercentage` as an EduConnect compatibility score and render backend-provided `matchingReasons` under a product explanation group. Raw semantic similarity, semantic boost, vector IDs, Qdrant metadata, document hashes, embedding model internals, and private Tutor/Student data are not exposed in the browser.

The frontend sends the grounded `learningGoal`, `weakTopics`, and `tutorPreferences` to Matching so Hybrid V2 has enough student-need context for semantic enhancement. Backend ranking order is preserved as returned; the AI result list is not resorted client-side. Manual Search remains independent from AI Matching and continues to use Search V2 filters.

Marketplace session persistence continues to store an AI result snapshot in `sessionStorage` with TTL/account scoping. Detail -> Back and F5 restore the saved AI result without replaying Analyze, Ground, Matching, or embedding calls. If semantic enhancement fails but Matching returns deterministic V1 fallback results, the UI treats the request as successful and does not expose provider/vector-store technical errors.

## Phase 4.4.6 - Semantic Evaluation Seed Enrichment

Phase 4.4.6 enriches development-only Tutor semantic seed data for credible offline evaluation. The indexed Tutor document fields remain unchanged: public Tutor bio, subject, category, level, experience context, and capability-level teaching description. Subject-specific expertise is kept primarily in `tutor_subject_registrations.description` because the semantic index stores one vector per Tutor capability and level.

The development dataset now gives overlapping hard scopes more realistic diversity, especially Mathematics Grade 12 / national exam, Java, Spring Boot, Database Systems, TOEIC, IELTS, React, Physics, and Chemistry. Examples of intended diversity include spatial geometry versus algebra/functions, foundational remediation versus exam strategy, Spring Security/JWT/RBAC versus REST/JPA/database, and project mentoring versus beginner debugging. These descriptions are natural Tutor capability summaries, not query keyword stuffing.

Qdrant remains derived data. Re-indexing should compare `documentHash` before embedding and only embed changed capability documents; unchanged points must be skipped. The collection architecture remains `tutor_capabilities_v1`, one vector per capability-level, `gemini-embedding-2`, 768 dimensions, Cosine distance.

The evaluation set used for this seed quality phase covers semantic-only and Hybrid V2 scenarios for Mathematics, Spring Boot, and TOEIC. Hybrid Matching remains bounded: deterministic V1 eligibility/scoring is still authoritative, semantic retrieval cannot introduce ineligible Tutors, missing semantic vectors are neutral, and the max rank boost remains `3.0`. Good behavior on this enriched synthetic development dataset does not prove production matching accuracy; production evaluation still needs real feedback labels, monitoring, and broader test coverage.

## Phase 4.6.2 - Class Search Boundary

Public Class Marketplace manual search remains Manual Search V1 in Learning Service. The class search endpoint uses authoritative backend filters, deterministic sort, and server pagination over public classroom data. Backend AI Class Search now has a separate semantic index/retrieval/ranking path; the manual marketplace flow remains independent.

Phase 4.6.2.1 keeps that boundary: Manual Class Marketplace omits the Subject dropdown for UX simplicity, but Learning backend still accepts precise `subjectId` and `levelId` for grounding/future AI flows. Manual Level selection can send repeated `levelIds` after deduplicating human labels across subjects, and manual schedule filters use Student availability semantics. No Gemini, embedding, or Qdrant class search work is implemented in this phase.

## Phase 4.6.3 - Class Natural Language Analyze/Ground

Phase 4.6.3 implements the first AI Class Search integration boundary without class ranking. `ai-service` now exposes Student-only `POST /api/ai/classes/analyze` and `POST /api/ai/classes/ground`. Analyze reuses the Gemini runtime pattern to extract class-search hints such as subject, level, teaching mode, budget, available schedules, learning goal, weak topics, class preferences, and optional location hint. Gemini does not generate catalog IDs, class IDs, scores, rankings, or recommendations.

Grounding remains deterministic Java logic over the Learning catalog snapshot. It resolves subject/level IDs from catalog data, returns blocking clarification for missing/ambiguous/not-found/invalid subject-level relationships, and preserves optional class-search context for matching. The Class Marketplace UI has a large modal entry point for Analyze -> Ground -> Review, but it does not mutate manual filters and final AI-ranked class result rendering remains future frontend work.

## Phase 4.6.4-4.6.5 - Backend Class Semantic Index and Hybrid Ranking

Backend Class AI Search is implemented in `ai-service` behind Student-only `POST /api/ai/classes/match`. It consumes an already-grounded class requirement, pulls authoritative public class data from Learning Service, applies structured hard eligibility and scoring, then optionally applies semantic retrieval as a bounded enhancement.

Learning Service exposes `GET /api/public/classes/semantic-source` for public-safe source data. It reuses the public class filter path, only returns `PUBLISHED`/`ACTIVE` classes, can require `availableOnly=true`, and omits private meeting links, join keys, tutor email, and staff review metadata while including chapter text for semantic documents.

Class semantic indexing uses dedicated Qdrant collection `public_classes_v1`, 768-dimensional Gemini embeddings, Cosine distance, deterministic point IDs from `classId`, document hash/model/dimension/version skip, and stale point removal when a class is no longer present in the current public source set. Each vector represents one public class. The embedded document contains public educational text only: class title, class description, subject, category, level, and chapter title/description.

Semantic class retrieval embeds only learning-need context such as learning goal, weak topics, class preferences, subject, and level. It hard-scopes Qdrant by subject, level, and teaching mode, then validates every hit against Learning public class data so stale or ineligible vectors cannot enter the result set. Raw cosine similarity remains internal; it is not converted into `matchPercentage`.

Hybrid Class Matching V2 keeps structured class scoring as the baseline. Hard eligibility requires public status, subject, level, teaching mode, available seats, and schedule compatibility. Budget remains a score component rather than an absolute reject unless future product rules make it hard. Semantic retrieval cannot introduce classes that fail structured eligibility, missing vectors are neutral, and validated semantic rank adds only a bounded boost controlled by `CLASS_SEMANTIC_MATCHING_MAX_RANK_BOOST` (default `3.0`). If semantic context is missing or Gemini/Qdrant/Learning validation fails, the endpoint falls back to structured V1 ordering.

Runtime verification on 2026-10-05 used Learning Service on port `18082`, AI Service on port `18085`, and Qdrant on port `6333`: class index sync wrote 3 real points to `public_classes_v1`, Qdrant reported 3 points, and `POST /api/ai/classes/match` returned `rankingMode=HYBRID_V2` with a validated semantic boost.

## Phase 4.6.6 - Class AI Frontend Integration and Persistence

The Web Class Marketplace now integrates the final AI Class Search result flow. The large modal still follows Analyze -> Ground -> Review, then calls Student-only `POST /api/ai/classes/match` with the grounded requirement returned by deterministic grounding and a bounded `topK`. It does not rerun Analyze after clarification and does not call any separate semantic endpoint from the browser.

AI class results reuse the existing public class card design. Cards show the final backend `matchPercentage` as an EduConnect compatibility score and render backend `matchingReasons` under "Vì sao phù hợp". The browser does not expose raw semantic similarity, vector IDs, Qdrant metadata, document hashes, embedding model internals, score-breakdown internals, meeting links, join keys, tutor email, or private Student data.

Class Marketplace has separate Manual and AI modes. Manual filters, sorting, pagination, and URL state remain tied to Learning public class search. AI mode uses the backend result snapshot in returned order. The frontend stores manual state and AI snapshot separately in account-scoped, versioned, TTL-limited `sessionStorage`, so Detail -> Back and F5 restore AI cards without replaying Analyze, Ground, Match, Gemini, embedding, or Qdrant calls.

Runtime note on 2026-10-05: Qdrant collection `public_classes_v1` was green with `points_count=3`. No bulk re-index was performed during frontend integration.

