# 🎓 Tutor Marketplace System – Development Guide (From Basic to Advanced)

## 🎯 Project Overview

This system is a **Tutor–Student Marketplace Platform** that supports:

- Student đăng ký và tìm lớp học hoặc gia sư
- Tutor tạo lớp học (1-1 hoặc 1-n)
- Student tham gia lớp
- Hỗ trợ cả:
  - Class có sẵn
  - On-demand (request + chat → tạo class)

- Mở rộng với AI (recommendation) và Blockchain (smart contract)

---

# ⚠️ IMPORTANT DEVELOPMENT RULES

- ❌ KHÔNG làm AI trước khi có dữ liệu
- ❌ KHÔNG làm Blockchain trước khi có flow ổn định
- ✅ Mỗi phase phải chạy được (working system)
- ✅ Luôn làm theo thứ tự từ dễ → khó
- ✅ Kiến trúc: Controller → Service → Repository

---

# 🧩 SYSTEM FLOW (BẮT BUỘC)

## 🔹 Flow 1: Class có sẵn

1. Student search class
2. Xem chi tiết
3. Join class
4. Học

---

## 🔹 Flow 2: On-demand (chưa có class)

1. Student search tutor
2. Gửi Request
3. (Optional) Chat realtime
4. Tutor accept
5. Tutor tạo class
6. Student join class

---

# 🚀 DEVELOPMENT PHASES

---

## 🔥 PHASE 1: CORE SYSTEM (BẮT BUỘC)

### 🎯 Mục tiêu:

Xây dựng hệ thống chạy được cơ bản

### 📦 Entities:

- User (role: STUDENT, TUTOR, ADMIN)
- TutorApplication
- Class
- Session
- Enrollment

### 📌 Yêu cầu:

- Thiết kế Class Diagram
- Thiết kế Database (ERD)
- Viết Entity (JPA hoặc Mongo)
- CRUD API:
  - User
  - Class
  - Enrollment

---

## 🔥 PHASE 2: SEARCH (KHÔNG AI)

### 🎯 Mục tiêu:

Cho phép student tìm lớp

### 📌 API:

- GET /classes?subject=&price=&schedule=

### 📌 Filter:

- subject
- price
- time

### 📌 Output:

- Danh sách class

---

## 🔥 PHASE 3: REQUEST + CHAT (MARKETPLACE)

### 📦 Entities:

- Request
- Message (chat)

### 🎯 Flow:

1. Student gửi request
2. Tutor accept/reject
3. Tutor tạo class

### 💬 Chat:

- Realtime bằng WebSocket / Socket.IO
- KHÔNG dùng chat làm business logic chính

---

## 🔥 PHASE 4: BUSINESS LOGIC

### 🎯 Xử lý:

- Join class
- Attendance
- Payment

### 📦 Entities bổ sung:

- Attendance
- Payment

---

## 🔥 PHASE 5: AI (SAU KHI CÓ DATA)

### 🎯 Mục tiêu:

Cải thiện trải nghiệm user

### 📌 Giai đoạn:

1. Rule-based recommendation
2. (Optional) Machine Learning

### 📌 Gợi ý:

- Recommend class theo lịch sử
- Match tutor – student

---

## 🔥 PHASE 6: BLOCKCHAIN (SMART CONTRACT)

### 🎯 Mục tiêu:

Minh bạch hóa hợp đồng và thanh toán

### 📦 Entity:

- Contract

### 📌 Khi tạo contract:

- Khi student join class
- Hoặc request được accept

### 📌 Lưu:

- txHash (transaction hash)

### 📌 Công nghệ:

- Solidity
- Ethereum (hoặc testnet)

---

# 🧠 ARCHITECTURE

- Controller → nhận request
- Service → xử lý logic
- Repository → DB
- WebSocket → chat realtime
- AI module → recommendation
- Blockchain → smart contract

---

# 🎯 FINAL GOALS

- ✅ Hệ thống chạy được từ Phase 1
- ✅ Có search + marketplace
- ✅ Có AI recommendation
- ✅ Có Blockchain contract
- ✅ Có thể viết báo cáo khóa luận hoàn chỉnh

---

# 🧪 HOW TO USE THIS GUIDE

- "Implement Phase 1" → chỉ làm Phase 1
- "Continue Phase 2" → làm tiếp
- KHÔNG được nhảy phase

---

# 🚀 EXPECTED RESULT

Một hệ thống:

- Có thể scale
- Có kiến trúc rõ ràng
- Có nâng cao (AI + Blockchain)
- Đủ mạnh để làm khóa luận tốt nghiệp

---
