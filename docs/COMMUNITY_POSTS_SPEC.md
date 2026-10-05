# EduConnect - Community Posts & Smart Polling

> Ngày rà soát: **2026-10-05**  
> Trạng thái nguồn hiện tại: **PHASE 1 & PHASE 2 IMPLEMENTED / PHASE 3 AI PLANNED**  
> Phân hệ phụ trách: `learning-service` sở hữu bài đăng, poll, vote, reaction, comment và liên kết `ClassRoom`; `notification-service` nhận sự kiện thông báo; `frontend-web` hiển thị và thao tác bảng tin; `ai-service` để sau.

Tài liệu này đã được đồng bộ với code thật. Mọi endpoint, phân quyền, luồng chuyển đổi sang lớp học và giao diện frontend đã được cài đặt và kiểm chứng bằng test.

## 1. Source Audit Snapshot

### Đã có trong code (Phase 1 & Phase 2)

- Migrations: `V38` tạo schema Community, `V39` siết toàn vẹn dữ liệu, `V40` loại các index bị trùng chức năng và `V41` bổ sung bookmark có unique constraint theo user/post.
- Backend entities/repositories: `CommunityPost`, `PostPoll`, `PostPollOption`, `PostPollVote`, `PostInteraction` và repository tương ứng.
- Backend controller: `CommunityPostController` với base path thật là **`/api/community`**.
- Backend service: `CommunityPostService` đã hỗ trợ:
  * search/detail, create/update post;
  * Siết phân quyền: `TUTOR_POLL` chỉ dành cho Tutor (ít nhất 2 option); bài tìm gia sư/học nhóm dành cho Student;
  * vote/unvote poll (chỉ Student mới được vote);
  * like/unlike, list/add comment và lưu/bỏ lưu bài viết;
  * Xóa bài viết an toàn (chuyển sang `status = HIDDEN`);
  * Smart Class Conversion: `POST /api/community/posts/{postId}/convert-to-class` tạo `ClassRoom` và `ClassSchedule` từ option bình chọn, gắn `linked_class_id`, đổi status bài post sang `CONVERTED`, đóng poll và phát sự kiện realtime cho học viên đã vote.
- Security: feed/search/detail là public; comments, danh sách đã lưu và mọi thao tác tương tác yêu cầu auth cookie JWT; thao tác ghi áp dụng CSRF theo `SecurityConfig`.
- Frontend API client: `frontend-web/src/api/community.js` (đã hỗ trợ đầy đủ các hàm bao gồm `convertPostToClass`).
- Frontend UI: `/community` và `/feed` redirect về `/community`; Portal Tutor có phân hệ Quản lý Bảng tin chuyên biệt `TutorCommunityManagement` tại `/dashboard?tab=community` lấy **"Bài đăng của tôi"** làm trung tâm quản lý (thống kê KPI, theo dõi chi tiết % vote từng ca học, đóng khảo sát, sửa/xóa bài, mở lớp thông minh) và tab Khám phá cộng đồng; feed công khai có tab bài đã lưu và chặn tương tác của khách chưa đăng nhập.
- UI đã có nút **"Mở lớp từ bài này"** cho Gia sư sở hữu bài poll, modal chọn ca học và banner lớp học đã mở.
- Unit tests: `CommunityPostServiceTest.java` bao phủ happy path và các nhánh role, validation, soft-delete, quorum, ownership, duplicate/closed conversion.

### Hướng phát triển tiếp theo (Phase 3 AI)

- AI-based Semantic matching và embedding trong `ai-service` (port 8085) sử dụng Qdrant vector database.
- AI Content Moderation tự động phát hiện ngôn từ tiêu cực hoặc spam.

## 2. Mục tiêu nghiệp vụ

Community Feed mở rộng tương tác hai chiều giữa Student và Tutor:

- Tutor đăng bài khảo sát mở lớp (`TUTOR_POLL`) kèm các lựa chọn khung giờ học.
- Student đăng bài tìm gia sư (`STUDENT_FIND_TUTOR`) hoặc tìm bạn học nhóm (`STUDENT_GROUP_STUDY`).
- Người dùng có thể xem feed, lọc theo loại bài, môn học, hình thức học, trạng thái, từ khóa.
- Người dùng đăng nhập có thể vote poll theo role, thả tim, bình luận và lưu bài viết. Khách chỉ được duyệt/tìm kiếm bài viết công khai.
- Phase 2 cần hoàn thiện Smart Class Conversion: Tutor chuyển bài poll đủ điều kiện thành `ClassRoom`, liên kết lại bài post và gửi thông báo cho học viên đã vote.

AI matching/semantic search là hướng tương lai. Không triển khai AI trong bước hoàn thiện này nếu chưa có yêu cầu riêng.

## 3. Kiến trúc sở hữu

- `learning-service` là chủ sở hữu dữ liệu Community Post/Poll/Vote/Interaction và liên kết lớp học.
- `learning-service` vẫn là chủ sở hữu `ClassRoom`; convert-to-class phải tái sử dụng rule tạo lớp hiện có, không tạo domain lớp học trùng ở service khác.
- `notification-service` chỉ nhận event/thông điệp đã được learning-service quyết định, rồi persist Bell notification và đẩy WebSocket.
- `frontend-web` chỉ gọi REST API; không tự dựng trạng thái lớp học giả sau khi convert.
- `ai-service` chưa có implementation matching/RAG/vector cho community feed.

## 4. Database hiện có

Migration V38-V41 đã tạo và siết chặt:

- `community_posts`: thông tin bài đăng, tác giả, loại bài, môn học, hình thức học, giá mục tiêu, địa chỉ, trạng thái, `linked_class_id`, counters.
- `post_polls`: câu hỏi khảo sát, mục tiêu vote, hạn khảo sát, tổng vote.
- `post_poll_options`: lựa chọn khung giờ, thứ trong tuần, giờ bắt đầu/kết thúc, số vote.
- `post_poll_votes`: một user chỉ có một vote trên mỗi poll.
- `post_interactions`: like, comment và bookmark; không tạo bảng bookmark trùng dữ liệu tương tác.

Database bắt buộc mỗi post chỉ có một poll, mỗi Student chỉ có một vote trong poll, option vote phải thuộc đúng poll, mỗi user chỉ có một like và một bookmark trên post, khung giờ không trùng và các counter không âm. ID người dùng là tham chiếu liên service nên không tạo foreign key sang database thuộc Account Service.

Các trạng thái bài đăng hiện dùng: `OPEN`, `CONVERTED`, `CLOSED`, `HIDDEN`.

## 5. REST API hiện tại

Base path thật trong source: **`/api/community`**.

| Method | Endpoint | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| `GET` | `/api/community/posts` | Implemented | Public; filter `postType`, `status`, `subjectId`, `learningMode`, `keyword`, `page`, `size`. |
| `GET` | `/api/community/posts/{id}` | Implemented | Public; tăng `viewCount`. |
| `GET` | `/api/community/posts/bookmarked` | Implemented | Authenticated; phân trang các bài chính người dùng đã lưu. |
| `POST` | `/api/community/posts` | Implemented | Active role đúng loại bài; poll validate sâu ngày, giờ, hạn và option. |
| `PUT` | `/api/community/posts/{id}` | Implemented | Author only; chỉ sửa post `OPEN`. |
| `DELETE` | `/api/community/posts/{id}` | Implemented | Author/Admin; soft-delete sang `HIDDEN`, không còn đọc công khai bằng list/detail/comment. |
| `POST` | `/api/community/polls/{pollId}/vote` | Implemented | Chỉ active role `STUDENT`; poll và post phải còn mở. |
| `DELETE` | `/api/community/polls/{pollId}/vote` | Implemented | Authenticated; hủy vote của chính mình. |
| `POST` | `/api/community/posts/{id}/reactions` | Implemented | Authenticated; toggle like. |
| `POST` | `/api/community/posts/{id}/bookmarks` | Implemented | Authenticated; toggle bookmark. |
| `GET` | `/api/community/posts/{id}/comments` | Implemented | Authenticated. |
| `POST` | `/api/community/posts/{id}/comments` | Implemented, cần moderation | Authenticated. |
| `POST` | `/api/community/posts/{postId}/convert-to-class` | Implemented | Tutor author; poll đủ quorum; tái sử dụng `ClassRoomService`; gửi persistent notification cho từng voter. |

Không dùng `/api/learning/community/...` cho frontend hiện tại trừ khi có quyết định đổi route và cập nhật gateway/client đồng bộ.

## 6. Phase 2 implementation đã chốt

- Post type và vote kiểm tra chính xác `activeRole`; Staff/Admin không được đi vào nhánh Student.
- Poll option dùng quy ước `1=Monday..7=Sunday`; khi tạo lớp chuyển sang quy ước dự án `2=Monday..8=Sunday`.
- Conversion khóa post bằng pessimistic write lock, chỉ nhận post/poll `OPEN`, chưa hết hạn và đạt `minVotesTarget`.
- Hồ sơ giảng dạy phải `APPROVED`, đúng môn theo tên giữa catalog cũ và catalog chuẩn; level phải active và thuộc registration.
- Conversion gọi `ClassRoomService.createClass`, do đó dùng chung kiểm tra học phí, mode, lịch rảnh, trùng lịch và syllabus.
- Lớp mới ở `PENDING_APPROVAL`; UI không quảng bá là đã mở đăng ký trước khi được duyệt.
- Mỗi voter nhận event `COMMUNITY_POST_CONVERTED_TO_CLASS` có id ổn định theo `(postId, classId, recipientUserId)`.
- Notification Service deduplicate, persist Bell notification và đẩy `/ws/notifications` đúng recipient.
- `linkedClassStatus` giúp frontend phân biệt lớp chờ duyệt với lớp `PUBLISHED/ACTIVE`.

## 7. Kiểm chứng bắt buộc

- Chạy full test của `learning-service` và `notification-service`.
- Chạy production build của `frontend-web`.
- Khi kiểm thử runtime, RabbitMQ và cả hai service phải chạy phiên bản source mới.

## 8. Không làm trong scope này

- Không triển khai AI recommendation/semantic search.
- Không tạo service mới.
- Không chuyển Community/Post ownership ra khỏi `learning-service`.
- Không đổi auth sang localStorage/Bearer-only.
- Không gọi đây là microservices; baseline hiện tại là Service-Based Architecture.
