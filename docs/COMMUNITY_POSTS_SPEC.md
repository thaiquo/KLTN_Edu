# EduConnect - Community Posts & Smart Polling

Follow/feed refinement note (2026-10-09): `tutorUserId` is the Tutor account user id, not `tutorProfileId`; Student can follow only an APPROVED Tutor projection in `TutorAuthorizationState`. The normal `/api/community/posts` feed remains public, but authenticated users with followed tutors get followed Tutor posts first and then `createdAt DESC`; `followingOnly=true` is the strict followed-tutor-only filter.

> Ngày rà soát: **2026-10-10**  
> Trạng thái nguồn hiện tại: **COMMUNITY, SMART POLLING & TUTOR FOLLOW IMPLEMENTED**
> Phân hệ phụ trách: `learning-service` sở hữu bài đăng, poll, vote, reaction, comment và liên kết `ClassRoom`; `notification-service` nhận sự kiện thông báo; `frontend-web` hiển thị và thao tác bảng tin; `ai-service` để sau.

Tài liệu này đã được đồng bộ với code thật. Mọi endpoint, phân quyền, luồng chuyển đổi sang lớp học và giao diện frontend đã được cài đặt và kiểm chứng bằng test.

## 1. Source Audit Snapshot

### Đã có trong code (Phase 1 & Phase 2)

- Compact migrations: `V8` tạo schema Community, `V9` tạo bảng `tutor_follows`, `V10` chuẩn hóa tham chiếu Tutor profile và `V11` bổ sung `public_share_id` UUID cho lớp/bài viết.
- Backend entities/repositories: `CommunityPost`, `PostPoll`, `PostPollOption`, `PostPollVote`, `PostInteraction`, `TutorFollow` và repository tương ứng.
- Backend controller: `CommunityPostController` với base path thật là **`/api/community`**.
- Backend service: `CommunityPostService` & `TutorFollowService` đã hỗ trợ:
  * search/detail, create/update post;
  * Siết phân quyền: `TUTOR_POLL` chỉ dành cho Tutor (ít nhất 2 option); bài tìm gia sư/học nhóm dành cho Student;
  * Theo dõi 1 chiều: Học viên (`STUDENT`) theo dõi/hủy theo dõi Gia sư (`TUTOR`) qua `PUT/DELETE /api/community/tutors/{tutorUserId}/follow` (Idempotent), kiểm tra trạng thái và số followers qua `/follow-status`, `/following-tutors` và `/followers`;
  * Bảng tin ưu tiên cá nhân hóa: trả về `isAuthorFollowed: boolean`, hỗ trợ lọc `followingOnly=true` trên `/api/community/posts` và gắn badge `⭐ Đang theo dõi`;
  * vote/unvote poll (chỉ Student mới được vote);
  * like/unlike, list/add comment và lưu/bỏ lưu bài viết;
  * Xóa bài viết an toàn (chuyển sang `status = HIDDEN`);
  * Smart Class Conversion: `POST /api/community/posts/{postId}/convert-to-class` tạo `ClassRoom` và `ClassSchedule` từ option bình chọn, gắn `linked_class_id`, đổi status bài post sang `CONVERTED`, đóng poll và phát sự kiện realtime cho học viên đã vote.
- Security: feed/search/detail và đọc comments là public; vote & follow chỉ dành cho active role `STUDENT`, còn like/bookmark/comment chỉ dành cho active role `STUDENT` hoặc `TUTOR`; thao tác ghi áp dụng cookie JWT và CSRF theo `SecurityConfig`.
- Frontend API client: `frontend-web/src/api/community.js` (hỗ trợ đầy đủ các hàm follow, unfollow, getTutorFollowStatus, getFollowingTutors, followingOnly filter và convertPostToClass).
- Frontend UI:
  * `/community` có Tab **"⭐ Gia sư đang theo dõi"** (`followingOnly=true`), Tab Tất cả và Tab Bài đã lưu;
  * `PostCard.jsx` hiển thị badge `⭐ Đang theo dõi` và nút bấm Theo dõi/Bỏ theo dõi nhanh cho Học viên;
  * `TutorMarketplacePage.jsx` và `PublicTutorProfilePage.jsx` hiển thị chỉ số Followers và nút Theo dõi gia sư;
  * Portal Học viên (`StudentCommunityManagement`) có Tab **"3. Gia sư đang theo dõi"**; Portal Gia sư (`TutorCommunityManagement`) có KPI **"Người theo dõi"**.
- Unit tests: `TutorFollowServiceTest.java` và `CommunityPostServiceTest.java` bao phủ happy path, idempotency, role check, self-follow validation, follower count, and feed following filters (53 tests PASS 100%).

### Hướng phát triển tiếp theo (Phase 3 AI)

- AI-based Semantic matching và embedding trong `ai-service` (port 8085) sử dụng Qdrant vector database.
- AI Content Moderation tự động phát hiện ngôn từ tiêu cực hoặc spam.

## 2. Mục tiêu nghiệp vụ

Community Feed mở rộng tương tác hai chiều giữa Student và Tutor:

- Tutor đăng bài khảo sát mở lớp (`TUTOR_POLL`) với 21 ô lịch cố định theo `7 ngày x 3 buổi`; đây là nhu cầu theo buổi, không phải giờ học chính thức.
- Student đăng bài tìm gia sư (`STUDENT_FIND_TUTOR`) hoặc tìm bạn học nhóm (`STUDENT_GROUP_STUDY`).
- Người dùng có thể xem feed, lọc theo loại bài, môn học, hình thức học, trạng thái, từ khóa.
- Student và Tutor có thể thả tim, bình luận và lưu bài viết; chỉ Student được vote poll. Khách chỉ được duyệt/tìm kiếm bài viết công khai, còn Staff/Admin giám sát qua phân hệ quản trị.
- Phase 2 cho phép Tutor chuyển poll `OPEN` hoặc `CLOSED`, kể cả đã hết hạn, thành `ClassRoom`; kết quả vote chỉ là gợi ý và không yêu cầu quorum bắt buộc. Hệ thống liên kết lại bài post và gửi thông báo cho học viên đã vote.

AI Matching và chatbot đã thuộc `ai-service`; Community feed hiện chỉ dùng ưu tiên Follow xác định, chưa dùng semantic ranking.

Đề xuất lịch từ khảo sát là thuật toán nghiệp vụ xác định, không phải AI Matching. Với lớp nhiều buổi/tuần, hệ thống ưu tiên tổ hợp ca mà nhiều học viên cùng chọn đủ toàn bộ lịch; tổng vote từng ca chỉ là tiêu chí phụ. Tổ hợp sau đó mới được đối chiếu với lịch rảnh riêng và lịch lớp đang chiếm chỗ của gia sư. Kết quả chỉ điền trước vào wizard tạo lớp dùng chung, kèm số người phù hợp và sĩ số tham khảo; gia sư được sửa toàn bộ và hệ thống không tự tạo lớp.

## 3. Kiến trúc sở hữu

- `learning-service` là chủ sở hữu dữ liệu Community Post/Poll/Vote/Interaction và liên kết lớp học.
- `learning-service` vẫn là chủ sở hữu `ClassRoom`; convert-to-class phải tái sử dụng rule tạo lớp hiện có, không tạo domain lớp học trùng ở service khác.
- `notification-service` nhận event đã được learning-service quyết định để persist Bell/WebSocket; riêng danh thiếp chat, service gọi endpoint public-safe của Learning để xác thực UUID trước khi lưu tham chiếu.
- `frontend-web` chỉ gọi REST API; không tự dựng trạng thái lớp học giả sau khi convert.
- `ai-service` đã có matching/RAG/vector cho các luồng AI riêng, nhưng Community feed hiện không dùng semantic ranking; feed chỉ ưu tiên theo Tutor Follow xác định.

## 4. Database hiện có

Compact migration `V8` tạo và siết chặt:

- `community_posts`: thông tin bài đăng, tác giả, loại bài, môn học, hình thức học, giá mục tiêu, địa chỉ, trạng thái, `linked_class_id`, counters.
- `post_polls`: câu hỏi khảo sát, mục tiêu vote, hạn khảo sát, tổng vote.
- `post_poll_options`: lựa chọn khung giờ, thứ trong tuần, giờ bắt đầu/kết thúc, số vote.
- `post_poll_votes`: một Student có tối đa một vote trên mỗi option của poll; tổng số option được chọn bị giới hạn bởi `maxVotesPerUser`.
- `post_interactions`: like, comment và bookmark; không tạo bảng bookmark trùng dữ liệu tương tác.

Database bắt buộc mỗi post chỉ có một poll, mỗi Student chỉ có một vote trên cùng một option, option vote phải thuộc đúng poll, mỗi user chỉ có một like và một bookmark trên post, khung giờ không trùng và các counter không âm. `maxVotesPerUser` được service kiểm tra khi thêm lựa chọn. ID người dùng là tham chiếu liên service nên không tạo foreign key sang database thuộc Account Service.

Các trạng thái bài đăng hiện dùng: `OPEN`, `CONVERTED`, `CLOSED`, `HIDDEN`.

## 5. REST API hiện tại

Base path thật trong source: **`/api/community`**.

| Method | Endpoint | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| `GET` | `/api/community/posts` | Implemented | Public; filter `postType`, `status`, `subjectId`, `learningMode`, `keyword`, `followingOnly`, `page`, `size`. |
| `GET` | `/api/community/posts/{id}` | Implemented | Public; tăng `viewCount`. |
| `GET` | `/api/community/posts/bookmarked` | Implemented | Authenticated; phân trang các bài chính người dùng đã lưu. |
| `PUT` | `/api/community/tutors/{tutorUserId}/follow` | Implemented | Active role `STUDENT`; theo dõi gia sư (Idempotent), trả về `FollowStatusResponse`. |
| `DELETE` | `/api/community/tutors/{tutorUserId}/follow` | Implemented | Active role `STUDENT`; hủy theo dõi gia sư (Idempotent). |
| `GET` | `/api/community/tutors/{tutorUserId}/follow-status` | Implemented | Public/Authenticated; kiểm tra trạng thái follow và tổng số followers. |
| `GET` | `/api/community/following-tutors` | Implemented | Active role `STUDENT`; lấy danh sách các gia sư đang theo dõi. |
| `GET` | `/api/community/tutors/{tutorUserId}/followers` | Implemented | Tutor owner / Staff / Admin; phân trang danh sách followers. |
| `POST` | `/api/community/posts` | Implemented | Active role đúng loại bài; poll validate sâu ngày, giờ, hạn và option. |
| `PUT` | `/api/community/posts/{id}` | Implemented | Author only; chỉ sửa post `OPEN`. |
| `DELETE` | `/api/community/posts/{id}` | Implemented | Author/Admin; soft-delete sang `HIDDEN`, không còn đọc công khai bằng list/detail/comment. |
| `POST` | `/api/community/polls/{pollId}/vote` | Implemented | Chỉ active role `STUDENT`; poll và post phải còn mở. |
| `PUT` | `/api/community/polls/{pollId}/votes` | Implemented | Luồng Web ưu tiên: thay toàn bộ lựa chọn của Student trong một transaction; click trên lịch chỉ sửa bản nháp local và nút Lưu mới ghi DB một lần. |
| `DELETE` | `/api/community/polls/{pollId}/vote` | Implemented | Authenticated; hủy vote của chính mình. |
| `POST` | `/api/community/posts/{id}/reactions` | Implemented | Active role `STUDENT` hoặc `TUTOR`; toggle like. |
| `GET` | `/api/community/posts/{id}/likes` | Implemented | Public/Authenticated; trả về danh sách chi tiết người thích bài viết (`userId`, `userRole`, `userName`, `userAvatar`, `createdAt`) phục vụ popup xem lượt thích cho tác giả/thành viên. |
| `POST` | `/api/community/posts/{id}/bookmarks` | Implemented | Active role `STUDENT` hoặc `TUTOR`; toggle bookmark. |
| `GET` | `/api/community/posts/{id}/comments` | Implemented | Public; xem danh sách bình luận công khai. |
| `POST` | `/api/community/posts/{id}/comments` | Implemented, cần moderation | Active role `STUDENT` hoặc `TUTOR`. |
| `POST` | `/api/community/posts/{postId}/convert-to-class` | Implemented | Tutor author; nhận poll `OPEN` hoặc `CLOSED`, kể cả hết hạn, không yêu cầu quorum; tái sử dụng `ClassRoomService`; gửi persistent notification cho từng voter. |

Không dùng `/api/learning/community/...` cho frontend hiện tại trừ khi có quyết định đổi route và cập nhật gateway/client đồng bộ.

## 5.1 Quy tắc Tìm kiếm, Sắp xếp và Liên kết Chia sẻ (Deep Link)

- **Sắp xếp mặc định**: Mặc định luôn sắp xếp bài đăng mới nhất theo thời gian (`createdAt DESC`), đảm bảo bài vừa đăng hiển thị ngay trên đầu bảng tin.
- **Tìm kiếm từ khóa (`keyword`)**: Loại bỏ các dropdown lọc môn/hình thức tĩnh bị lệch danh mục; thay bằng thanh tìm kiếm từ khóa duy nhất. Backend `searchPosts` tự động match đa chiều qua: `title`, `content`, `authorName`, `educationLevel`, tên môn học `subject.name` và tên lớp gắn kèm `linkedClass.name`.
- **Chia sẻ Bài viết (`/share/posts/{publicShareId}`)**:
  - URL mới dùng UUID ổn định, không đưa khóa chính số vào liên kết được tạo mới.
  - `GET /api/community/posts/shared/{publicShareId}` tải trạng thái hiện tại; bài `HIDDEN` hoặc đã xóa trả 404.
  - Khi hợp lệ, frontend tái sử dụng `CommunityFeedPage` và `PostCard`, cuộn/highlight đúng bài.
- **Chia sẻ Lớp học (`/share/classes/{publicShareId}`)**:
  - `GET /api/learning/public/classes/shared/{publicShareId}` chỉ trả lớp `PUBLISHED` và không lộ meeting link/join key.
  - Lớp đã đủ chỗ vẫn xem được chi tiết công khai; quyền đăng ký được quyết định riêng theo sức chứa và vòng đời lớp.
  - Khi hợp lệ, frontend tái sử dụng `ClassMarketplacePage` và `PublicClassDetailModal`.
- **Danh thiếp trong chat**:
  - Notification Service lưu `resourceType`, `publicShareId` và caption tùy chọn, không snapshot dữ liệu lớp/bài viết.
  - Trước khi gửi và khi hiển thị/mở, trạng thái được đối chiếu lại với Learning Service; tài nguyên không còn công khai hiển thị là không khả dụng.
- **Xem danh sách người thích bài viết**: Tác giả Gia sư và người xem có thể bấm trực tiếp vào số lượt thích trên bài viết hoặc tab quản lý bài đăng để mở popup `PostLikesModal` xem chi tiết danh sách tài khoản đã thả tim.

## 6. Phase 2 implementation đã chốt

- Post type và vote kiểm tra chính xác `activeRole`; Staff/Admin không được đi vào nhánh Student.
- Poll option dùng quy ước `1=Monday..7=Sunday`; khi tạo lớp chuyển sang quy ước dự án `2=Monday..8=Sunday`.
- Conversion khóa post bằng pessimistic write lock, nhận post/poll `OPEN` hoặc `CLOSED`, kể cả hết hạn; `minVotesTarget` chỉ là mốc tham khảo để Tutor ra quyết định.
- Hồ sơ giảng dạy phải `APPROVED`, đúng môn theo tên giữa catalog cũ và catalog chuẩn; level phải active và thuộc registration.
- Conversion gọi `ClassRoomService.createClass`, do đó dùng chung kiểm tra học phí, mode, lịch rảnh, trùng lịch và syllabus.
- Lớp mới ở `PENDING_APPROVAL`; UI không quảng bá là đã mở đăng ký trước khi được duyệt.
- Mỗi voter nhận event `COMMUNITY_POST_CONVERTED_TO_CLASS` có id ổn định theo `(postId, classId, recipientUserId)`.
- Notification Service deduplicate, persist Bell notification và đẩy `/ws/notifications` đúng recipient.
- `linkedClassStatus` và `linkedClassAcceptingEnrollment` giúp frontend phân biệt lớp chờ duyệt/lịch sử với lớp còn tuyển sinh và chỉ mở điều hướng gửi yêu cầu ở lớp đủ điều kiện.

## 7. Kiểm chứng bắt buộc

- Full test 2026-10-10: `learning-service` 201 PASS; `notification-service` 74 PASS.
- Frontend `npx tsc --noEmit` PASS và production build PASS.
- Khi kiểm thử runtime, RabbitMQ và cả hai service phải chạy phiên bản source mới.

## 8. Không làm trong scope này

- Không triển khai AI recommendation/semantic search.
- Không tạo service mới.
- Không chuyển Community/Post ownership ra khỏi `learning-service`.
- Không đổi auth sang localStorage/Bearer-only.
- Không gọi đây là microservices; baseline hiện tại là Service-Based Architecture.
