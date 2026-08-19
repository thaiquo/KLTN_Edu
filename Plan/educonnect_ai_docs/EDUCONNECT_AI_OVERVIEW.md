# EDUCONNECT_AI_OVERVIEW.md

## 1. Mục tiêu của AI trong EduConnect

AI trong EduConnect không phải là phần thay thế logic nghiệp vụ hiện tại.  
Hệ thống phải hoạt động tốt với tìm kiếm, lọc, lớp học, hợp đồng, thanh toán... ngay cả khi chưa có AI.

AI được xem là **lớp nâng cấp thông minh** nhằm:

- Hỗ trợ người dùng tra cứu thông tin bằng ngôn ngữ tự nhiên.
- Hỗ trợ tìm kiếm gia sư và lớp học thông minh hơn.
- Gợi ý gia sư/lớp học phù hợp.
- Trả lời câu hỏi về quy trình và quy định của EduConnect.
- Tra cứu dữ liệu cá nhân theo thời gian thực thông qua API nội bộ.
- Giảm thao tác lọc thủ công và tăng trải nghiệm người dùng.

---

# 2. Kiến trúc backend hiện tại

```text
backend/
├── account-service
├── api-gateway
├── contract-service
├── learning-service
├── notification-service
└── ai-service              # thêm sau khi chức năng cơ bản ổn định
```

## Vai trò từng service

### account-service

Quản lý:

- User
- Student
- Tutor
- Profile
- TutorProfile
- Thông tin tài khoản
- Xác minh gia sư

### learning-service

Quản lý:

- Subject
- Grade/Class level
- TutorSubject
- Đăng ký môn dạy
- Classroom
- Curriculum/Lộ trình học
- Schedule
- Enrollment
- Learning Session
- Tìm kiếm gia sư
- Tìm kiếm lớp học

### contract-service

Quản lý:

- Contract
- Payment
- Escrow
- Refund
- Dispute
- Blockchain integration
- Smart Contract integration
- Transaction Hash
- Blockchain Event

Blockchain và Smart Contract vẫn thuộc `contract-service`.

Không cần tách riêng:

```text
blockchain-service
smart-contract-service
payment-service
```

trong phạm vi khóa luận hiện tại.

### notification-service

Quản lý:

- Email
- Notification
- Reminder
- Realtime notification

### api-gateway

Quản lý:

- Routing
- Authentication Filter
- Authorization
- Rate Limiting
- Điều hướng request tới các service

### ai-service

Sẽ được bổ sung sau để xử lý:

- AI Chatbot
- RAG
- Embedding
- Vector Search
- Natural Language Search
- Tool Calling
- Recommendation
- Ranking

---

# 3. Nguyên tắc quan trọng

AI Service **không sở hữu dữ liệu nghiệp vụ chính**.

Ví dụ:

```text
Account DB  → account-service
Learning DB → learning-service
Contract DB → contract-service
```

Không được thiết kế:

```text
AI Service
   ↓
đọc trực tiếp Account DB
đọc trực tiếp Learning DB
đọc trực tiếp Contract DB
```

Nên thiết kế:

```text
AI Service
   ↓
Internal REST API
   ↓
Account / Learning / Contract Service
```

Ví dụ:

```text
AI Service
   ↓
GET /internal/students/{id}/classes
   ↓
Learning Service
```

---

# 4. Giai đoạn hiện tại: chưa cần AI

Ở giai đoạn đầu, EduConnect chỉ cần hoàn thiện **tìm kiếm truyền thống**.

## 4.1 Tìm kiếm gia sư

Các tiêu chí:

- Keyword
- Subject
- Grade/Class level
- Teaching Mode: ONLINE / OFFLINE
- Min Price
- Max Price
- Rating
- Experience
- Sort
- Pagination

Ví dụ:

```http
GET /api/tutors/search?
subjectId=1
&gradeId=12
&mode=ONLINE
&minPrice=150000
&maxPrice=250000
&page=0
&size=10
```

### Business Rule quan trọng

Gia sư chỉ được xuất hiện trong kết quả nếu môn/lớp tương ứng đã được Admin duyệt.

Ví dụ:

```text
Tutor
 └── English
      ├── Grade 10 → APPROVED
      ├── Grade 11 → APPROVED
      └── Grade 12 → PENDING
```

Search `English + Grade 12`:

```text
Tutor không được xuất hiện.
```

Search `English + Grade 11`:

```text
Tutor được xuất hiện.
```

Điều kiện:

```text
TutorSubject.status = APPROVED
```

---

# 5. Tìm kiếm lớp học

Các tiêu chí:

- Keyword
- Subject
- Grade
- Learning Mode
- Min Price
- Max Price
- Schedule
- Available Seat
- Tutor
- Sort
- Pagination

Ví dụ:

```http
GET /api/classes/search?
subjectId=1
&gradeId=12
&mode=ONLINE
&minPrice=150000
&maxPrice=250000
&available=true
&page=0
&size=10
```

Một lớp chỉ nên xuất hiện công khai khi đủ điều kiện nghiệp vụ.

Ví dụ trạng thái:

```text
DRAFT
  ↓
PENDING_APPROVAL
  ↓
APPROVED
  ↓
OPEN
  ↓
FULL
  ↓
IN_PROGRESS
  ↓
COMPLETED
```

Search public chủ yếu lấy:

```text
status = OPEN
```

và:

```text
currentStudents < maxStudents
```

---

# 6. Công nghệ Search ở giai đoạn đầu

Chưa cần:

- AI
- Elasticsearch
- Qdrant
- Embedding

Có thể dùng:

```text
Spring Data JPA
+
JpaSpecificationExecutor
+
PostgreSQL
```

Keyword search ban đầu:

```sql
ILIKE '%keyword%'
```

Dynamic filter:

```text
Subject
Grade
Mode
Price
Rating
Status
Schedule
```

Mục tiêu là xây Search API ổn định trước.

---

# 7. Lộ trình phát triển AI

## Phase 1 — Traditional Search

```text
User
 ↓
Filter
 ↓
Learning Service
 ↓
PostgreSQL
 ↓
Tutor / Classroom
```

Chức năng:

- Search Tutor
- Search Classroom
- Filter
- Sort
- Pagination

Đây là phase hiện tại.

---

## Phase 2 — Natural Language Search

Người dùng không cần chọn từng filter.

Ví dụ:

```text
"Tôi cần gia sư Toán 12 học online buổi tối,
ngân sách khoảng 200.000đ/buổi."
```

AI chuyển thành:

```json
{
  "subject": "MATH",
  "grade": 12,
  "mode": "ONLINE",
  "time": "EVENING",
  "maxPrice": 200000
}
```

Sau đó AI vẫn gọi Search API đã có:

```text
Natural Language
       ↓
AI Service
       ↓
Extract Search Parameters
       ↓
Existing Tutor Search API
       ↓
PostgreSQL
```

AI **không thay search hiện tại**.

AI chỉ giúp chuyển ngôn ngữ tự nhiên thành search parameter.

---

# 8. Phase 3 — Semantic Search

Search thông thường chủ yếu dựa vào keyword.

Semantic Search tìm theo **ý nghĩa**.

Ví dụ:

```text
Query:
"gia sư luyện thi đại học môn Toán"
```

Tutor Profile:

```text
"Có 5 năm kinh nghiệm ôn thi THPT Quốc gia môn Toán."
```

Dù câu chữ khác nhau, Semantic Search vẫn xác định hai nội dung có ý nghĩa gần nhau.

Kiến trúc:

```text
Text
 ↓
Embedding Model
 ↓
Vector
 ↓
Qdrant
 ↓
Semantic Results
```

---

# 9. Embedding

Embedding là quá trình chuyển nội dung text thành vector số.

Ví dụ:

```text
"Gia sư Toán lớp 12 luyện thi THPT"
```

↓

```text
[0.142, -0.527, 0.391, ...]
```

Những nội dung có ý nghĩa giống nhau sẽ có vector gần nhau.

Embedding dùng cho:

- Tutor Profile
- Classroom Description
- Student Request
- FAQ
- Policy
- Knowledge Base

---

# 10. Vector Database

EduConnect có thể sử dụng:

```text
Qdrant
```

Ví dụ dữ liệu Tutor:

```json
{
  "id": "tutor_123",
  "vector": [...],
  "payload": {
    "tutorId": 123,
    "subjectId": 1,
    "gradeIds": [10, 11, 12],
    "mode": ["ONLINE"],
    "price": 180000
  }
}
```

Qdrant dùng để:

- tìm vector gần nhất;
- Semantic Search;
- RAG Retrieval;
- hỗ trợ Recommendation.

---

# 11. Phase 4 — Recommendation Engine

Recommendation không chỉ dựa vào AI.

Nên dùng mô hình:

```text
Semantic Matching
+
Business Rules
+
Ranking
```

Ví dụ:

```text
FinalScore =
0.30 × SemanticScore
+ 0.25 × SubjectScore
+ 0.15 × GradeScore
+ 0.10 × ScheduleScore
+ 0.10 × PriceScore
+ 0.05 × RatingScore
+ 0.05 × ExperienceScore
```

Các hướng recommendation:

```text
Student → Tutor
Student → Classroom
Tutor   → Student Request
```

---

# 12. Rule-Based Scoring

Rule-Based Scoring là tính điểm dựa trên dữ liệu nghiệp vụ.

Ví dụ Student cần:

```text
Subject = Math
Grade = 12
Mode = Online
Time = Evening
Max Price = 200000
```

Tutor:

```text
Math       ✔
Grade 12   ✔
Online     ✔
Evening    ✔
180000     ✔
```

Tutor đó sẽ có RuleScore cao.

Business Rule phải được ưu tiên vì Semantic Search có thể tìm nội dung phù hợp nhưng Tutor thực tế:

- không dạy grade đó;
- không đúng mức giá;
- không rảnh;
- môn chưa được duyệt.

---

# 13. Phase 5 — AI Chatbot RAG

RAG:

```text
Retrieval-Augmented Generation
```

Ý tưởng:

```text
Tìm thông tin trước
       ↓
đưa thông tin cho LLM
       ↓
LLM mới trả lời
```

Không dùng:

```text
User → Gemini → Answer
```

Nên dùng:

```text
User Question
      ↓
Embedding
      ↓
Qdrant
      ↓
Retrieve Knowledge
      ↓
Context
      ↓
Gemini
      ↓
Answer
```

RAG dùng cho các câu hỏi như:

- Làm sao đăng ký làm gia sư?
- Điều kiện mở lớp là gì?
- Gia sư có được xóa lớp không?
- Quy định thanh toán thế nào?
- Điều kiện hoàn tiền?
- Quy trình ký hợp đồng?
- Quy định hủy lớp?

---

# 14. Knowledge Base

Knowledge Base là kho dữ liệu mà Chatbot được phép sử dụng.

Ví dụ:

```text
knowledge/
├── account.md
├── tutor-registration.md
├── tutor-subject-policy.md
├── classroom-policy.md
├── contract-policy.md
├── payment-policy.md
├── refund-policy.md
├── dispute-policy.md
└── faq.md
```

Knowledge Base có thể lấy từ:

- tài liệu nghiệp vụ;
- FAQ;
- quy định;
- hướng dẫn sử dụng;
- chính sách hệ thống.

---

# 15. Chunking

Không embedding nguyên một tài liệu dài.

Tài liệu phải được chia thành các đoạn nhỏ:

```text
Document
 ↓
Chunking
 ↓
Chunk 1
Chunk 2
Chunk 3
...
 ↓
Embedding
 ↓
Qdrant
```

Ví dụ:

```text
Chunk 1 → Quy trình đăng ký Tutor
Chunk 2 → Quy trình Admin duyệt
Chunk 3 → Quy định tạo lớp
Chunk 4 → Quy định thanh toán
Chunk 5 → Quy định hoàn tiền
```

Khi user hỏi hoàn tiền, hệ thống chỉ lấy các chunk liên quan.

---

# 16. LLM

LLM có thể là:

- Gemini
- GPT
- hoặc model tương đương

Nhiệm vụ của LLM:

- hiểu câu hỏi;
- phân loại intent;
- extract search parameters;
- tổng hợp câu trả lời;
- viết câu trả lời tự nhiên;
- quyết định cần dùng RAG hay Tool Calling.

LLM không phải database.

LLM không nên tự suy đoán dữ liệu nghiệp vụ.

---

# 17. Hallucination

Hallucination là khi AI tạo thông tin không có thật.

Ví dụ hệ thống quy định:

```text
Hoàn tiền trong 5 ngày.
```

nhưng AI trả lời:

```text
Hoàn tiền trong 7 ngày.
```

Để hạn chế:

- dùng RAG;
- dùng Tool Calling;
- ép LLM trả lời dựa trên Context;
- nếu không đủ dữ liệu thì trả lời "không có đủ thông tin";
- không cho LLM tự tạo policy.

---

# 18. Tool Calling

RAG chỉ phù hợp cho Knowledge Base.

Dữ liệu realtime phải lấy từ các service.

Ví dụ user hỏi:

```text
"Hôm nay tôi có lớp nào?"
```

Không dùng RAG.

Flow:

```text
User
 ↓
AI Service
 ↓
LLM xác định intent
 ↓
Learning Tool
 ↓
Learning Service
 ↓
Database
 ↓
Class/Schedule Data
 ↓
LLM
 ↓
Response
```

Ví dụ tools:

```text
getMyClasses()
getMySchedule()
getMyContracts()
getPendingPayments()
searchTutors()
searchClasses()
```

---

# 19. RAG và Tool Calling

## RAG

Dùng cho dữ liệu dạng tri thức:

```text
FAQ
Policy
Rules
Documentation
Guideline
```

Ví dụ:

```text
"Hủy lớp có được hoàn tiền không?"
```

→ RAG.

## Tool Calling

Dùng cho dữ liệu cá nhân/realtime:

```text
Class
Schedule
Contract
Payment
Profile
```

Ví dụ:

```text
"Hợp đồng của tôi đã được thanh toán chưa?"
```

→ Tool Calling.

---

# 20. Intent

Intent là mục đích của câu hỏi.

Ví dụ:

```text
"Tôi học lớp nào hôm nay?"
```

Intent:

```text
GET_MY_SCHEDULE
```

Ví dụ:

```text
"Tìm gia sư IELTS dưới 250k."
```

Intent:

```text
SEARCH_TUTOR
```

Ví dụ:

```text
"Điều kiện hoàn tiền là gì?"
```

Intent:

```text
FAQ_REFUND
```

Điều hướng:

```text
FAQ
   → RAG

SEARCH_TUTOR
   → Search / Recommendation

GET_MY_SCHEDULE
   → Tool Calling
```

---

# 21. Conversation Memory

Chatbot nên hỗ trợ hội thoại nhiều bước.

Ví dụ:

```text
User:
Tôi muốn tìm gia sư Toán 12.

AI:
Bạn muốn học online hay offline?

User:
Online.
```

AI phải hiểu `Online` vẫn thuộc yêu cầu tìm gia sư Toán 12.

Có thể lưu:

```text
ChatSession
- id
- userId
- createdAt

ChatMessage
- id
- sessionId
- role
- content
- createdAt
```

Không cần gửi toàn bộ lịch sử chat cho LLM.

Có thể:

- lấy N message gần nhất;
- hoặc summarize conversation.

---

# 22. Cấu trúc ai-service dự kiến

```text
ai-service/
│
├── chat/
│   ├── ChatController
│   ├── ChatService
│   └── ConversationService
│
├── rag/
│   ├── RagService
│   ├── RetrievalService
│   ├── ChunkService
│   └── KnowledgeService
│
├── embedding/
│   └── EmbeddingService
│
├── vector/
│   └── QdrantService
│
├── recommendation/
│   ├── TutorRecommendationService
│   ├── ClassroomRecommendationService
│   └── RankingService
│
├── tool/
│   ├── AccountTool
│   ├── LearningTool
│   └── ContractTool
│
└── llm/
    └── GeminiService
```

Tên package/class chỉ là định hướng, có thể điều chỉnh khi triển khai.

---

# 23. Luồng AI Search Tutor tương lai

User nhập:

```text
"Tôi muốn tìm gia sư Toán 12 luyện thi đại học,
online buổi tối, khoảng 200k."
```

## Bước 1: LLM hiểu yêu cầu

```json
{
  "subject": "MATH",
  "grade": 12,
  "mode": "ONLINE",
  "time": "EVENING",
  "maxPrice": 200000,
  "semanticQuery": "luyện thi đại học môn Toán"
}
```

## Bước 2: Search

Filter cứng:

```text
Subject
Grade
Mode
Price
Availability
Approval Status
```

Semantic Search:

```text
"luyện thi đại học môn Toán"
```

## Bước 3: Ranking

```text
Semantic Score
+
Rule Score
```

## Bước 4: Response

AI giải thích vì sao Tutor phù hợp.

---

# 24. Luồng RAG Chatbot tương lai

```text
User Question
      ↓
AI Service
      ↓
Embedding
      ↓
Qdrant
      ↓
Top Relevant Chunks
      ↓
Prompt + Context
      ↓
LLM
      ↓
Answer
```

Ví dụ:

```text
User:
Gia sư hủy lớp thì tôi có được hoàn tiền không?
```

Qdrant lấy:

```text
refund-policy.md
contract-policy.md
```

LLM trả lời dựa trên policy thật.

---

# 25. Luồng Tool Calling tương lai

```text
User:
"Tôi còn khoản nào chưa thanh toán?"
```

↓

```text
AI Service
```

↓

```text
Intent = GET_PENDING_PAYMENT
```

↓

```text
ContractTool
```

↓

```text
Contract Service
```

↓

```text
Database / Blockchain State
```

↓

```text
LLM
```

↓

```text
Natural Language Response
```

---

# 26. Công nghệ dự kiến

Vì backend EduConnect sử dụng Spring Boot, có thể ưu tiên:

```text
Spring Boot
Spring AI
Gemini API
Qdrant
PostgreSQL
```

Vai trò:

```text
Spring Boot → AI Service
Spring AI   → tích hợp LLM/RAG/Tool Calling
Gemini      → LLM
Qdrant      → Vector Database
PostgreSQL  → dữ liệu nghiệp vụ
```

Không bắt buộc sử dụng đúng stack này nếu sau này có công nghệ phù hợp hơn.

---

# 27. Nguyên tắc phát triển

## Không làm AI trước business logic

Thứ tự:

```text
Business Logic
     ↓
Search
     ↓
API ổn định
     ↓
AI Integration
```

## Không phụ thuộc hoàn toàn vào AI

Nếu AI/Gemini lỗi:

```text
Search Tutor
Search Classroom
Booking
Contract
Payment
Learning
```

vẫn phải hoạt động.

## AI không quyết định business rule

Ví dụ:

```text
TutorSubject chưa APPROVED
```

AI không được phép override để cho Tutor xuất hiện.

Business Rule do backend quyết định.

---

# 28. Roadmap đề xuất

## Phase 1

### Traditional Search

- Tutor Search
- Classroom Search
- Filter
- Sort
- Pagination

Status:

```text
ƯU TIÊN LÀM TRƯỚC
```

---

## Phase 2

### AI Natural Language Search

```text
Natural Language
→ Extract Filter
→ Existing Search API
```

---

## Phase 3

### Semantic Search

- Embedding Tutor Profile
- Embedding Classroom
- Qdrant
- Vector Search

---

## Phase 4

### Recommendation Engine

- Student → Tutor
- Student → Classroom
- Tutor → Student Request
- Rule Ranking
- Semantic Ranking

---

## Phase 5

### RAG Chatbot

- FAQ
- Policy
- Business Process
- Knowledge Base
- Source-based Answer

---

## Phase 6

### Personal AI Assistant

- Tool Calling
- Tra cứu lớp của user
- Tra cứu lịch học
- Tra cứu hợp đồng
- Tra cứu thanh toán
- Tra cứu trạng thái yêu cầu

---

# 29. Những chức năng AI chưa ưu tiên

Trong phạm vi khóa luận hiện tại không cần ưu tiên:

- AI tự dạy học
- AI chấm bài tự động
- AI nhận diện cảm xúc
- AI tạo video
- AI Tutor Voice
- AI sinh toàn bộ giáo trình
- Computer Vision
- AI giám sát camera

Các chức năng trên có thể mở rộng trong tương lai nhưng không thuộc AI Core hiện tại.

---

# 30. Tóm tắt kiến trúc AI cuối cùng

```text
                         USER
                           │
                           ▼
                     API Gateway
                           │
                           ▼
                      AI Service
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
          RAG         Tool Calling    Recommendation
           │               │               │
        Qdrant       Internal APIs    Qdrant + Rules
           │               │               │
    Knowledge Base    Account/Learning/   Tutor/Class
                      Contract Service
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                          LLM
                           │
                           ▼
                        Response
```

---

# 31. Quy tắc ngắn gọn cho AI Coding Assistant

Khi phát triển AI cho EduConnect, phải tuân thủ:

1. Không thay đổi business rule hiện có chỉ để phục vụ AI.
2. Search truyền thống phải hoạt động độc lập trước khi tích hợp AI.
3. AI Service không truy cập trực tiếp database của service khác.
4. Dữ liệu realtime phải lấy qua Internal API / Tool Calling.
5. FAQ, policy và documentation dùng RAG.
6. Search ngữ nghĩa dùng Embedding + Qdrant.
7. Recommendation phải kết hợp Semantic Score và Rule-Based Score.
8. Chỉ TutorSubject đã `APPROVED` mới được tham gia search/recommendation.
9. AI không tự tạo dữ liệu nghiệp vụ nếu backend không cung cấp.
10. Nếu thiếu context thì AI phải báo không đủ thông tin thay vì hallucination.
11. Tận dụng Search API hiện có thay vì viết lại toàn bộ search trong AI Service.
12. AI là lớp nâng cấp trải nghiệm, không phải core bắt buộc để EduConnect vận hành.

---

# 32. Mục tiêu cuối cùng

EduConnect hướng tới mô hình:

```text
Traditional Platform
       +
Natural Language Search
       +
Semantic Search
       +
Hybrid Recommendation
       +
RAG Chatbot
       +
Realtime Tool Calling
```

Trong đó:

```text
LLM
= hiểu và tạo ngôn ngữ

Embedding
= chuyển ý nghĩa thành vector

Qdrant
= lưu và tìm vector

RAG
= tìm tri thức rồi mới trả lời

Tool Calling
= lấy dữ liệu nghiệp vụ realtime

Recommendation
= tìm và xếp hạng Tutor/Class phù hợp
```

Đây là định hướng AI tổng thể để các AI Coding Assistant có thể đọc và tiếp tục phát triển EduConnect theo đúng kiến trúc, không làm lệch business domain hiện tại.
