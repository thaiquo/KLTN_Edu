# EduConnect AI Service

Service xử lý AI cho nền tảng EduConnect (AI Chatbot, RAG, Tutor Recommendation & Ranking, Natural Language Search).

## 📌 Thông tin cấu hình
* **Port mặc định:** `8084`
* **Route qua API Gateway:** `/api/ai/**` -> `http://localhost:8084`
* **Quản lý biến môi trường:** Load trực tiếp từ root `.env` (`AI_SERVICE_PORT`, `GEMINI_API_KEY`, `QDRANT_HOST`, ...)

## 🚀 Cách khởi chạy cục bộ
```bash
cd backend/ai-service
./run-local.sh
```

## 🏗️ Kiến trúc mô đun dự kiến (Planned Architecture)
* `chat/`: Quản lý đoạn hội thoại Chatbot tư vấn học liệu & tìm kiếm gia sư.
* `rag/`: Retrieval-Augmented Generation (Retrieval, Chunking, Knowledge Base).
* `vector/`: Kết nối Vector Database (Qdrant) để thực hiện Semantic Search.
* `recommendation/`: Thuật toán đề xuất & gợi ý Gia sư / Lớp học phù hợp với nhu cầu Học viên.
* `llm/`: Client kết nối Google Gemini API (hoặc OpenAI).
