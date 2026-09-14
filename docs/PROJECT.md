# EduConnect — Tổng quan dự án

> Cập nhật theo source và dữ liệu kiểm chứng ngày **2026-09-14**.  
> Đây là trang bắt đầu để đọc dự án. Trạng thái chi tiết nằm ở [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## 1. Mục tiêu

EduConnect là nền tảng kết nối Học viên và Gia sư, hỗ trợ tìm kiếm lớp/gia sư, xét duyệt hồ sơ, quản lý lớp và buổi học, hợp đồng điện tử, ký quỹ USDC, điểm danh độc lập, quyết toán theo buổi, khiếu nại và thông báo.

Hai năng lực kỹ thuật nổi bật:

- Blockchain/Smart Contract bảo toàn tiền ký quỹ và thực hiện payout/refund minh bạch trên Sepolia.
- AI Matching là hướng phát triển hỗ trợ tìm kiếm/xếp hạng; hiện mới có `ai-service` skeleton và health endpoint, chưa có mô hình, embedding, RAG hoặc vector search.

## 2. Kiến trúc được xác nhận

EduConnect dùng **Service-Based Architecture**, không gọi là Microservices Architecture khi chưa có quyết định mới.

| Thành phần | Port | Trách nhiệm hiện tại |
| --- | ---: | --- |
| `api-gateway` | 8080 | Spring Cloud Gateway, CORS, REST/WebSocket routing. |
| `account-service` | 8081 | JWT/OTP/session, user/role, hồ sơ Student/Tutor, hồ sơ xét duyệt Tutor, S3. |
| `learning-service` | 8082 | Danh mục, chuyên môn/lịch rảnh, lớp, enrollment, lịch học, buổi học, điểm danh, bài tập. |
| `contract-service` | 8083 | Hợp đồng, EIP-712, DOCX/PDF, escrow, transaction pipeline, settlement, dispute và evidence. |
| `notification-service` | 8084 | Notification lưu bền, Bell REST/WebSocket; chat persistence/API/WebSocket. |
| `ai-service` | 8085 | Service skeleton và `GET /api/ai/health`; AI nghiệp vụ chưa triển khai. |
| `frontend-web` | 5173 | React/Vite cho Guest, Student, Tutor, Staff, Admin. |
| `mobile-app` | Expo | Đăng ký/đăng nhập/home cơ bản; chưa tương đương Web. |

Luồng liên service hiện dùng kết hợp REST đồng bộ, RabbitMQ event, WebSocket và blockchain event polling. Chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md).

## 3. Actor và quyền nghiệp vụ

- Guest: đăng ký/đăng nhập và xem dữ liệu công khai.
- Student: tìm lớp/gia sư, gửi yêu cầu học, ký hợp đồng, ký quỹ, tham gia lớp, tự điểm danh, học/nộp bài, theo dõi ví và khiếu nại của chính mình.
- Tutor: hoàn thiện hồ sơ xét duyệt, quản lý chuyên môn/lịch/lớp/yêu cầu học, cập nhật link lớp, tự điểm danh, giao/chấm bài, ký hợp đồng, theo dõi payout và phản hồi khiếu nại.
- Staff: xét duyệt và giám sát theo lớp/phạm vi được giao, xử lý khiếu nại thuộc phạm vi.
- Admin: quản trị toàn hệ thống, giám sát hợp đồng/giao dịch và phân xử toàn cục.

Trình duyệt dùng JWT trong HttpOnly cookie; `activeRole` quyết định ngữ cảnh quyền hiện tại. Xem [AUTH_SECURITY.md](AUTH_SECURITY.md).

## 4. Luồng nghiệp vụ chính đang có

```text
Đăng ký/OTP → đăng nhập → tìm lớp/gia sư → yêu cầu tham gia
→ Tutor chấp nhận → tạo và hai bên ký EIP-712
→ backend đăng ký agreement on-chain → Student fundAgreement bằng USDC
→ AgreementFunded được xác nhận → ACTIVE/ENROLLED
→ sinh buổi học cuốn chiếu → hai bên tự điểm danh
→ chốt outcome → đề xuất settlement on-chain → cửa sổ khiếu nại 24 giờ
→ không khiếu nại: tự finalize; có khiếu nại: giữ tiền đến phán quyết
→ SessionSettled xác nhận → cập nhật lịch sử ví/buổi học và thông báo.
```

Các chuyển trạng thái tài chính chỉ được coi là hoàn tất sau khi Contract Service ingest event xác nhận từ smart contract; receipt hoặc dữ liệu local đơn lẻ không đủ để tuyên bố tiền đã chuyển.

## 5. Quy tắc quyết toán đã xác nhận

Mỗi Student có một agreement/escrow riêng, nên settlement và dispute theo cặp `(agreementId, sessionId)`, không khóa tiền của cả lớp.

| Outcome | Tutor | Platform | Hoàn Student |
| --- | ---: | ---: | ---: |
| `BOTH_PRESENT` | 85% | 15% | 0% |
| `STUDENT_ABSENT_TUTOR_PRESENT` | 45% | 10% | 45% |
| `TUTOR_ABSENT` (kể cả cả hai cùng vắng) | 0% | 0% | 100% |

Tỷ lệ được tính theo base unit của USDC; Tutor và Platform được làm tròn xuống độc lập, phần dư thuộc Student để bảo toàn tổng tiền.

## 6. Quy tắc buổi học và khiếu nại

- Tutor và từng Student điểm danh độc lập trong đúng ngày và khung giờ buổi học; Tutor không được điểm danh hộ Student.
- Student chỉ thấy link phòng học và nội dung/file bài tập sau khi tự điểm danh.
- Link nằm ở cấp lớp. Tutor có thể cập nhật khi link hỏng; các buổi sau dùng link mới.
- Hết giờ, scheduler chốt `BOTH_PRESENT`, `STUDENT_ABSENT_TUTOR_PRESENT` hoặc `TUTOR_ABSENT`.
- Cửa sổ khiếu nại 24 giờ bắt đầu từ lúc đề xuất settlement được xác nhận on-chain, không bắt đầu trực tiếp từ giờ tan học.
- Khiếu nại hợp lệ lập tức giữ settlement riêng đó. V1 chỉ hỗ trợ on-chain tutor-fraud dispute cho `BOTH_PRESENT`.
- Student và Tutor xem lịch sử thuộc quyền của mình; Student không được xem khiếu nại do Tutor gửi hoặc evidence/phản hồi riêng của Tutor.
- Với đơn do Student gửi, Tutor có 24 giờ từ lúc nộp đơn để phản hồi. Staff/Admin xử lý ngay nếu Tutor đã phản hồi, hoặc sau khi hết hạn phản hồi; không có hạn phân xử tiếp theo và tiền tiếp tục bị giữ.
- Evidence hỗ trợ text và file ảnh/video/audio/PDF/TXT/Word/Excel, tối đa 50 MB. Cấu hình hiện tại dùng S3 với key `disputes/{agreementId}/sessions/{sessionId}/{role}/...`; metadata và SHA-256 lưu trong PostgreSQL.

## 7. Công nghệ hiện dùng

- Backend: Java 21+, Spring Boot, Spring Security, Spring Data JPA, Flyway, Bean Validation.
- Gateway: Spring Cloud Gateway WebFlux.
- Web: React 19, Vite, TypeScript/JavaScript, React Router, TanStack Query, Tailwind CSS, Recharts.
- Mobile: Expo 53, React Native 0.79.
- Data/messaging: PostgreSQL 16, RabbitMQ 3.13.
- Storage/document: AWS SDK S3, poi-tl, Gotenberg/LibreOffice.
- Blockchain: Solidity 0.8.36, OpenZeppelin, Foundry, Web3j, ethers.js, MetaMask/Reown AppKit.
- Infra local: Docker Compose cho PostgreSQL, RabbitMQ và Gotenberg.

## 8. Trạng thái ngắn gọn

- Đã có luồng chính Web cho Account, Tutor approval, catalog/class/enrollment, session/attendance/homework, contract/escrow/settlement/dispute và notification.
- Sepolia đã có bằng chứng funding, payout 85/15 và refund 100% thực tế; chi tiết transaction nằm trong [BLOCKCHAIN.md](BLOCKCHAIN.md).
- Chat backend có persistence/API/WebSocket nhưng Portal message hiện vẫn dùng mock state, nên luồng người dùng chưa hoàn chỉnh.
- AI Matching chưa triển khai nghiệp vụ; `ai-service` mới là skeleton.
- Student post, violation/support ticket, báo cáo quản trị đầy đủ và mobile feature parity chưa có.
- Bốn agreement legacy nạp sai bằng raw ERC-20 transfer đã được `legacy_excluded`; không tham gia KPI hoặc tự quyết toán.

## 9. Cách đọc tài liệu

- Trạng thái theo feature/UC: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- Quy tắc nghiệp vụ: [BUSINESS_RULES.md](BUSINESS_RULES.md)
- Kiến trúc và ownership: [ARCHITECTURE.md](ARCHITECTURE.md)
- API và tích hợp frontend: [API.md](API.md)
- Auth/security: [AUTH_SECURITY.md](AUTH_SECURITY.md)
- Blockchain/escrow: [BLOCKCHAIN.md](BLOCKCHAIN.md)
- Session/attendance: [session/EDUCONNECT_SESSION_IMPLEMENTATION_STATUS.md](session/EDUCONNECT_SESSION_IMPLEMENTATION_STATUS.md)
- AI: [AI_MATCHING.md](AI_MATCHING.md)
- Notification/realtime: [FEEDBACK_NOTIFICATION_SPEC.md](FEEDBACK_NOTIFICATION_SPEC.md)

Các master plan/lịch sử triển khai dài trong thư mục con là tài liệu tham chiếu theo thời điểm. Khi khác với code hoặc tài liệu canonical ở trên, ưu tiên code hiện tại và `IMPLEMENTATION_STATUS.md`.
