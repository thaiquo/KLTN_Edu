# EduConnect — AI Matching

> Cập nhật theo source ngày **2026-09-14**.

## 1. Vai trò

AI Matching là năng lực hỗ trợ tìm kiếm, gợi ý và xếp hạng Tutor/Class phù hợp với nhu cầu Student. AI không thay thế quyền quyết định của người dùng, không vượt qua authorization và không được bỏ qua hard business filters.

## 2. Trạng thái hiện tại

Trạng thái: **SKELETON**, chưa phải AI implementation.

Đã có:

- Maven module `backend/ai-service` dùng Java 21 và Spring Boot 3.4.1;
- port mặc định 8085;
- Gateway route `/api/ai/**`;
- `GET /api/ai/health` trả trạng thái service skeleton;
- Web route `/matching` và các khối UI giới thiệu matching.

Chưa có:

- model provider/client thực tế;
- Spring AI dependency;
- Qdrant container/client/collection;
- embedding/chunking/indexing;
- semantic search;
- recommendation/scoring/ranking service;
- RAG/chatbot persistence;
- API matching ngoài health;
- evaluation, feedback loop, metrics hoặc safety monitoring.

Search/filter đang có trong Account/Learning là deterministic search, không được ghi là AI.

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
