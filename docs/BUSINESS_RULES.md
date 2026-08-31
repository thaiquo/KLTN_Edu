# EduConnect Business Rules

## 1. Actors

- Guest: người dùng chưa đăng nhập, được đăng ký và tra cứu thông tin công khai.
- Student: học viên sử dụng nền tảng để tìm kiếm, kết nối, học tập, quản lý hợp đồng và thanh toán.
- Tutor: gia sư cung cấp hoạt động giảng dạy, quản lý hồ sơ/lớp học/hợp đồng và theo dõi thu nhập.
- Staff: nhân viên vận hành, kiểm duyệt, giám sát, xử lý vi phạm/khiếu nại và hỗ trợ người dùng.
- Admin: quản trị hệ thống, danh mục, người dùng, Blockchain, thanh toán và báo cáo.

## 2. Role Model

Target baseline có 5 nhóm tác nhân: Guest, Student, Tutor, Staff, Admin.

Student và Tutor là hai vai trò nghiệp vụ chính trong quá trình kết nối và học tập. Một người dùng có thể đi theo luồng học viên hoặc gia sư tùy hồ sơ và trạng thái xét duyệt. Source hiện tại có role model và active role trong JWT, phù hợp với định hướng nhiều vai trò nhưng chi tiết current implementation thuộc `docs/IMPLEMENTATION_STATUS.md`.

## 3. Business Capabilities by Actor

### Guest

- Đăng ký tài khoản.
- Tra cứu thông tin công khai về gia sư, lớp học tuyển sinh và bài đăng tìm gia sư.

### Student

- Quản lý yêu cầu tham gia lớp.
- Quản lý thông tin cá nhân.
- Quản lý hợp đồng với Tutor.
- Quản lý bài đăng tìm gia sư.
- Quản lý tin nhắn với Tutor.
- Xem thông tin lớp học.
- Quản lý bài tập: xem bài tập, nộp bài, xem kết quả.
- Quản lý thanh toán phía học viên: ký quỹ, theo dõi trạng thái ký quỹ, lịch sử thanh toán/giải ngân liên quan.

### Tutor

- Quản lý hồ sơ gia sư và trạng thái xét duyệt.
- Quản lý yêu cầu tham gia lớp.
- Quản lý lịch rảnh.
- Quản lý lớp học.
- Quản lý buổi học và điểm danh.
- Quản lý bài tập: tạo/cập nhật bài tập, xem bài nộp, chấm điểm.
- Quản lý hợp đồng với Student.
- Quản lý tin nhắn với Student.
- Theo dõi thu nhập và các khoản giải ngân phát sinh từ hoạt động giảng dạy.

### Staff

- Kiểm duyệt nội dung như hồ sơ gia sư và bài đăng tìm gia sư theo phạm vi quy định.
- Quản lý vi phạm.
- Giám sát lớp học.
- Xử lý khiếu nại.
- Hỗ trợ người dùng.

### Admin

- Quản lý người dùng.
- Quản lý danh mục, bao gồm cấp học và môn học.
- Quản lý Blockchain: tra cứu hợp đồng và xác minh tính toàn vẹn thông tin hợp đồng đã ghi nhận.
- Quản lý thanh toán ở góc độ quản trị/giám sát giao dịch.
- Báo cáo thống kê người dùng, lớp học, hợp đồng và doanh thu.

## 4. Use Case Baseline

| UC | Use Case | Actor | Target |
|---|---|---|---|
| UC001 | Đăng ký | Guest | Tạo tài khoản để tham gia hệ thống. |
| UC002 | Đăng nhập | Student, Tutor, Staff, Admin | Xác thực để truy cập nghiệp vụ theo vai trò. |
| UC003 | Tra cứu | Guest | Tra cứu thông tin công khai. |
| UC004 | Quản lý yêu cầu tham gia lớp | Student | Gửi, theo dõi, hủy yêu cầu tham gia lớp. |
| UC005 | Quản lý thông tin cá nhân | Student | Cập nhật và quản lý thông tin cá nhân. |
| UC006 | Quản lý hợp đồng | Student, Tutor | Hai bên xem, theo dõi trạng thái, ký hoặc từ chối hợp đồng theo nghiệp vụ. |
| UC007 | Quản lý bài đăng tìm gia sư | Student | Tạo và quản lý nhu cầu tìm gia sư. |
| UC008 | Quản lý tin nhắn | Student, Tutor | Trao đổi tin nhắn hai chiều giữa Student và Tutor. |
| UC009 | Xem thông tin lớp học | Student | Xem thông tin lớp mình quan tâm hoặc tham gia. |
| UC010 | Quản lý bài tập | Student | Xem bài tập, nộp bài, xem kết quả. |
| UC011 | Quản lý thanh toán | Student | Thực hiện và theo dõi thanh toán/ký quỹ phía học viên. |
| UC012 | Quản lý hồ sơ gia sư | Tutor | Gửi, cập nhật và theo dõi hồ sơ xét duyệt. |
| UC013 | Quản lý yêu cầu tham gia lớp | Tutor | Xem, chấp nhận hoặc từ chối yêu cầu tham gia lớp. |
| UC014 | Quản lý lịch rảnh | Tutor | Cập nhật thời gian có thể giảng dạy. |
| UC015 | Quản lý lớp học | Tutor | Tạo, cập nhật, quản lý lớp tuyển sinh và danh sách học viên. |
| UC016 | Quản lý buổi học | Tutor | Tạo/cập nhật buổi học và điểm danh. |
| UC017 | Quản lý bài tập | Tutor | Tạo, cập nhật, xem bài nộp và chấm điểm. |
| UC018 | Theo dõi thu nhập | Tutor | Theo dõi khoản giải ngân và lịch sử thu nhập. |
| UC019 | Kiểm duyệt nội dung | Staff | Kiểm duyệt nội dung cần xác minh. |
| UC020 | Quản lý vi phạm | Staff | Tiếp nhận/xem báo cáo vi phạm và đề xuất xử lý. |
| UC021 | Giám sát lớp học | Staff | Theo dõi hoạt động lớp học để phát hiện trường hợp cần can thiệp. |
| UC022 | Xử lý khiếu nại | Staff | Tiếp nhận, xem minh chứng và cập nhật kết quả xử lý. |
| UC023 | Hỗ trợ người dùng | Staff | Hỗ trợ Student/Tutor khi phát sinh vấn đề. |
| UC024 | Quản lý người dùng | Admin | Quản lý thông tin và trạng thái tài khoản. |
| UC025 | Quản lý danh mục | Admin | Quản lý dữ liệu dùng chung như cấp học và môn học. |
| UC026 | Quản lý Blockchain | Admin | Theo dõi, tra cứu, kiểm chứng dữ liệu Blockchain liên quan hợp đồng. |
| UC027 | Quản lý thanh toán | Admin | Theo dõi trạng thái và tra cứu giao dịch ở góc độ quản trị. |
| UC028 | Báo cáo thống kê | Admin | Xem thông tin tổng hợp phục vụ quản trị. |

## 5. Core Business Rules

- Account/Role: người dùng đăng ký, xác thực và sử dụng hệ thống theo vai trò được cấp.
- Tutor approval: Tutor cần hồ sơ định danh đáp ứng điều kiện xét duyệt trước khi dùng đầy đủ chức năng gia sư.
- Tutor application lifecycle: Tutor mới đăng ký và xác thực email có tài khoản/role Tutor nhưng hồ sơ xét duyệt bắt đầu ở `TutorApplication.status=DRAFT`, nghĩa là chưa gửi cho Staff. Hồ sơ xét duyệt hiện chỉ yêu cầu giấy tờ định danh: CCCD/CMND hai mặt hoặc hộ chiếu. `PENDING` chỉ áp dụng cho hồ sơ đã được Tutor submit và đang chờ Staff xét duyệt. `REJECTED` có thể chỉnh sửa/resubmit về `PENDING`; `APPROVED` mở quyền Tutor đầy đủ.
- Tutor teaching setup: đăng ký lớp học, môn/lĩnh vực dạy và các nghiệp vụ giảng dạy đầy đủ thuộc giai đoạn sau khi Tutor đã `APPROVED`, không phải điều kiện bắt buộc của hồ sơ xét duyệt ban đầu.
- Tutor restricted mode: Tutor có hồ sơ `DRAFT`, `PENDING` hoặc `REJECTED` vẫn được đăng nhập/switch sang ngữ cảnh Gia sư để xem trạng thái, cập nhật hồ sơ, upload tài liệu và gửi/gửi lại hồ sơ theo flow hiện có. Chỉ Tutor `APPROVED` mới được dùng đầy đủ các chức năng giảng dạy.
- Tutor profile: hồ sơ gia sư cung cấp thông tin để hệ thống và Staff xác minh.
- Search: Guest và user có thể tra cứu thông tin công khai; thao tác nghiệp vụ yêu cầu đăng nhập.
- Join request: Student gửi yêu cầu tham gia lớp; Tutor xử lý yêu cầu theo trạng thái và điều kiện lớp.
- Class: Tutor tạo/quản lý lớp tuyển sinh; Student xem thông tin lớp; Staff/Admin có nghiệp vụ giám sát/duyệt theo phạm vi.
- Contract: khi Student và Tutor đạt thỏa thuận, hai bên cùng tham gia quản lý hợp đồng.
- Learning: quá trình học gồm lớp học, buổi học, điểm danh và các hoạt động theo dõi tiến độ.
- Session: dữ liệu buổi học là cơ sở quan trọng phục vụ theo dõi tiến độ và settlement.
- Homework: Tutor giao/chấm bài; Student nộp bài và xem kết quả.
- Messaging: Student và Tutor trao đổi tin nhắn để hỗ trợ kết nối, thỏa thuận và sử dụng nền tảng.
- Payment: Student thực hiện nghiệp vụ thanh toán/ký quỹ phía học viên.
- Income: Tutor theo dõi khoản thu nhập/giải ngân, không đồng nhất với Student payment.
- Complaint: khi phát sinh vấn đề, Staff tiếp nhận và xử lý khiếu nại theo quy trình.
- Staff moderation: Staff kiểm duyệt nội dung, giám sát lớp, quản lý vi phạm, hỗ trợ người dùng.
- Admin management: Admin quản lý người dùng, danh mục, Blockchain, thanh toán và thống kê.

## 6. Contract & Payment Business Relationship

- Student và Tutor cùng tham gia Contract.
- Student quản lý Payment của mình, gồm ký quỹ và theo dõi trạng thái thanh toán.
- Tutor theo dõi Income, gồm các khoản được giải ngân từ hoạt động giảng dạy.
- Admin quản lý Payment ở góc độ quản trị và giám sát giao dịch.

Ba nghiệp vụ Student Payment, Tutor Income và Admin Payment Administration là khác nhau, không được gộp thành một chức năng giống nhau.

## 7. AI Matching in Business Flow

AI Matching hỗ trợ gợi ý và xếp hạng trong nghiệp vụ tìm kiếm/kết nối. AI không thay thế core search, business rules, hoặc quyết định cuối cùng của người dùng. AI Matching không bắt buộc xuất hiện như một Use Case độc lập trong Use Case Diagram.

Hệ thống vẫn có business flow hợp lệ khi AI chưa triển khai; khi đó tìm kiếm/lọc thủ công vẫn là luồng nghiệp vụ nền.

## 8. Change Policy

Business rules có thể thay đổi trong quá trình phát triển. Khi người dùng xác nhận business rule mới:

1. Rule mới thay thế rule cũ trong phạm vi được xác nhận.
2. Phải kiểm tra ảnh hưởng tới architecture, API, code và documentation.
3. Phải cập nhật các docs liên quan khi được yêu cầu.
