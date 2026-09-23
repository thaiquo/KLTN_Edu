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

### Quy tắc khiếu nại và quyết toán theo buổi

- Mỗi học viên có một hợp đồng escrow riêng với gia sư. Vì vậy điểm danh, đề xuất quyết toán, khiếu nại và giải ngân của cùng một buổi được xử lý độc lập theo từng học viên, không khóa toàn bộ lớp.
- Tutor và từng Student tự điểm danh bằng tài khoản của mình trong đúng ngày và khung giờ `[startTime, endTime)`. Tutor không được điểm danh hộ Student; Tutor chỉ được xem danh sách ai đã/chưa điểm danh.
- Nếu Tutor có mặt và Student có mặt: `BOTH_PRESENT`, trả 85% Tutor, 15% Platform.
- Nếu Tutor có mặt và Student vắng: `STUDENT_ABSENT_TUTOR_PRESENT`, trả 45% Tutor, 10% Platform và hoàn 45% Student.
- Nếu Tutor vắng, không phụ thuộc Student có mặt hay vắng: `TUTOR_ABSENT`, hoàn 100% Student.
- Tỷ lệ được tính theo USDC base units: phần Tutor và Platform làm tròn xuống riêng; phần còn lại hoàn Student để tổng payout/refund luôn bằng đúng giá một buổi.
- Cửa sổ khiếu nại 24 giờ bắt đầu khi đề xuất settlement được xác nhận on-chain. Nếu hệ thống tắt trước khi đề xuất được xác nhận thì 24 giờ chưa bắt đầu.
- Học viên và gia sư chỉ được gửi khiếu nại cho hợp đồng của chính mình khi đề xuất quyết toán còn trong cửa sổ 24 giờ và chưa giải ngân.
- Ngay khi yêu cầu khiếu nại hợp lệ được ghi nhận, settlement của học viên liên quan chuyển sang trạng thái giữ tiền; tác vụ giải ngân hết hạn 24 giờ không được chọn settlement này.
- Khi học viên khiếu nại, gia sư của lớp được thông báo ngay và được xem nội dung, bằng chứng của học viên; gia sư có thể gửi giải trình/bằng chứng riêng cho Staff/Admin.
- Với khiếu nại do học viên gửi, gia sư có 24 giờ tính từ `submittedAt` của đơn để nộp hoặc cập nhật giải trình. Admin/Staff phụ trách được phân xử ngay khi gia sư đã phản hồi; nếu chưa có phản hồi thì chỉ được phân xử từ lúc hết 24 giờ.
- Sau khi hết hạn giải trình, gia sư không được nộp/cập nhật thêm. Admin/Staff không có hạn chót bắt buộc phải phân xử; settlement tiếp tục ở trạng thái giữ tiền cho đến khi phán quyết on-chain hoàn tất.
- Khi gia sư chủ động khiếu nại, nội dung, bằng chứng và kết quả xử lý là báo cáo riêng cho Staff/Admin; học viên liên quan không được xem hồ sơ khiếu nại này.
- Admin hoặc Staff phụ trách lớp là bên phân xử. Với Smart Contract V1 hiện tại, luồng phân xử on-chain chỉ áp dụng an toàn cho đề xuất `BOTH_PRESENT`; các loại kết quả điểm danh khác cần phiên bản hợp đồng mới trước khi mở rộng khiếu nại on-chain.
- Lý do khiếu nại dạng text là bắt buộc. File evidence là tùy chọn và hỗ trợ ảnh, video, audio, PDF, TXT, Word và Excel tối đa 50 MB; object lưu trên storage/S3, metadata và SHA-256 lưu trong PostgreSQL.
- Khóa link phòng học trực tuyến trước khi điểm danh: Student chỉ được đọc link Google Meet/Zoom/Teams sau khi đã tự điểm danh trong khung giờ. Đây là ràng buộc giảm trường hợp vào học nhưng không ghi nhận attendance; không coi nó là bằng chứng tuyệt đối rằng người dùng thực sự học trọn buổi.
- Link phòng học thuộc classroom. Tutor có thể cập nhật khi link hỏng; lần đọc tiếp theo và các buổi kế tiếp dùng link mới, nhưng Student vẫn phải điểm danh từng buổi để mở khóa.
- Nếu service tắt qua deadline, scheduler không thể chuyển tiền trong lúc tắt. Khi Learning/Contract được mở lại, các session/settlement lưu bền được quét bù theo chu kỳ; dispute đang mở không bao giờ tự finalize.
- Staff moderation: Staff kiểm duyệt nội dung, giám sát lớp, quản lý vi phạm, hỗ trợ người dùng.
- Admin management: Admin quản lý người dùng, danh mục, Blockchain, thanh toán và thống kê.

### Quy tắc chấm dứt hợp đồng và hủy lớp học trước thời hạn

- **Phân định trách nhiệm và phạm vi theo Actor:**
  - **Phía Học viên (Student):** Mỗi học viên chỉ có **1 hợp đồng duy nhất** ở 1 lớp học. Vì vậy, khi gia sư vi phạm cam kết hoặc học viên gặp sự cố bất khả kháng, học viên có quyền gửi **yêu cầu đơn phương chấm dứt hợp đồng** của chính mình (`wholeClass = false`). Thao tác được thực hiện trực tiếp trong văn bản hợp đồng cá nhân.
  - **Phía Gia sư (Tutor):** Gia sư quản lý **toàn bộ lớp học** gồm nhiều học viên (nhiều hợp đồng). Gia sư **không được phép tự ý chấm dứt riêng lẻ từng hợp đồng** của từng học viên vì lý do cá nhân không thể tiếp tục giảng dạy. Nếu gia sư gặp sự cố bất khả kháng (sức khỏe, tai nạn, bận đột xuất...), gia sư phải vào mục **"Lớp học của tôi"** để gửi **"Đề xuất dừng giảng dạy & Hủy lớp học"** cho toàn bộ lớp (`wholeClass = true`).
- **Xác thực chữ ký số Web3 EIP-712:**
  - Mọi yêu cầu chấm dứt hoặc đề xuất hủy lớp bắt buộc phải ký số xác nhận Typed Data EIP-712 bằng chính địa chỉ ví đã ghi nhận trên hợp đồng (`studentWallet` cho học viên, `tutorWallet` cho gia sư).
  - Hệ thống kiểm tra đối chiếu ví kết nối MetaMask: nếu địa chỉ ví không khớp với ví đã ký hợp đồng và nạp cọc ban đầu, yêu cầu sẽ bị từ chối ngay lập tức để chống giả mạo danh tính và gian lận tài chính.
  - Quá trình ký EIP-712 hoàn toàn gasless (0 Sepolia ETH).
- **Quy trình thẩm định và phân xử của Ban Quản trị (Staff vs Admin):**
  - Khi có yêu cầu chấm dứt hoặc đề xuất hủy lớp, hệ thống đồng bộ hold với Learning (`HOLD_PENDING` nếu cần retry, sau đó `REQUESTED`). Cutoff lấy theo thời gian server lúc hold thành công, không lấy theo thời gian Admin xử lý.
  - Student hold chỉ chặn các buổi tương lai của hợp đồng đó; lớp và các Student khác tiếp tục bình thường. Tutor hold chặn các buổi tương lai của toàn lớp, đóng băng đăng ký mới và hiển thị `Chờ duyệt hủy lớp`.
  - Hold không gửi giao dịch blockchain và không hoàn tiền. Buổi đã bắt đầu trước cutoff vẫn hoàn tất attendance, settlement và cửa sổ dispute như bình thường.
  - **Phân định thẩm quyền:**
    - **Nhân viên (Staff):** Chỉ được xem và thẩm định các hồ sơ thuộc các lớp học do chính mình được phân công duyệt (`classroomReviewerEmail`). Staff có quyền ghi nhận ý kiến, yêu cầu bổ sung thông tin hoặc kiến nghị đề xuất (`RECOMMEND`), hoặc từ chối (`REJECT`). Staff không có thẩm quyền ra lệnh giải ngân/hoàn cọc Escrow.
    - **Quản trị viên (Admin):** Có quyền quản trị toàn hệ thống, xem tất cả hồ sơ. Admin có thẩm quyền tối cao phê duyệt (`APPROVE` trực tiếp từ `REQUESTED` hoặc `RECOMMENDED`) để kích hoạt quyết toán thanh lý Escrow V1, hoặc từ chối (`REJECT`) để giải phóng hold và khôi phục lớp học.
- **Tài liệu minh chứng đính kèm & Tính bất biến (Evidence Staging & Immutability):**
  - Học viên và Gia sư có thể đính kèm tối đa 5 file minh chứng (ảnh, video, ghi âm, tài liệu PDF, Word, Excel, TXT) với dung lượng tối đa 50 MB mỗi file.
  - **Khu vực đệm (Staging Area):** Khi chọn file hoặc soạn thảo nội dung giải trình, người dùng có thể xem trước và tùy ý xóa bỏ (`[✕ Xóa]`) các file chọn nhầm trước khi nhấn gửi chính thức.
  - **Tính bất biến sau khi nộp (Post-submission Immutability):** Ngay khi nhấn nút gửi, tài liệu được tải lên S3 (`terminations/{caseId}/{role}/{uuid}-{filename}`) kèm kiểm tra mã băm SHA-256 và whitelist MIME. Toàn bộ nội dung và minh chứng đã nộp sẽ được lưu vĩnh viễn vào hệ thống (audit trail), **không thể chỉnh sửa hay xóa bỏ**. Các lần bổ sung giải trình tiếp theo được phân tách và đánh số thứ tự rõ ràng (`LẦN 1`, `LẦN 2`...) kèm mốc thời gian gửi để đảm bảo tính minh bạch, khách quan trong phân xử.
  - Phân quyền truy cập minh chứng: Chỉ các bên trong hợp đồng/lớp học, Staff phụ trách duyệt lớp và Admin mới có quyền xem nội dung minh chứng qua streaming bảo mật.
- **Thanh lý và hoàn tiền Smart Contract Escrow khi Phê duyệt (`APPROVE`):**
  - **Cơ chế thời hạn 24 giờ và quyết toán:** Thời hạn 24 giờ là cửa sổ khiếu nại của từng buổi học đã dạy trước cutoff, **không phải là thời hạn chờ cố định sau khi Admin duyệt**. Khi Admin phê duyệt, worker kiểm tra các buổi học liên quan: nếu các buổi trước cutoff đã quyết toán xong (hoặc đã kết thúc 24h khiếu nại không có tranh chấp), worker lập tức kích hoạt giao dịch on-chain `cancelAgreementAndRefundUnused` để hoàn trả phần cọc còn dư (`remainingDeposit`) về ví học viên mà không cần chờ thêm.
  - **Trường hợp Học viên đơn phương chấm dứt (`wholeClass = false`):** Giữ nguyên cutoff đã chụp khi gửi yêu cầu. Các buổi đã diễn ra hợp lệ được quyết toán cho gia sư, và Smart Contract Escrow hoàn trả tiền cọc chưa sử dụng về ví MetaMask của học viên.
  - **Trường hợp Gia sư hủy toàn bộ lớp học (`wholeClass = true`):** Chuyển hold thành đóng lớp, hủy lịch tương lai sau cutoff và xử lý từng agreement độc lập bằng Escrow V1. Các buổi đã dạy được quyết toán; tiền chưa sử dụng được hoàn về ví từng học viên.
  - Khi hoàn tiền thành công trên Blockchain (`AgreementCancelled` confirmed): Cả hợp đồng (`contract_agreements`) và lượt đăng ký học (`enrollments`) đều chuyển sang trạng thái kết thúc `CANCELLED`; mốc dừng học chính thức đóng.
  - Khi Admin duyệt hủy cả lớp, lớp chuyển `LOCKED` trong thời gian từng agreement đang settlement; Gia sư không thể tự mở lại hoặc nhận học viên mới. Lớp chỉ chuyển `CANCELLED` sau khi tất cả agreement đã đóng và refund/settlement được xác nhận.
- **Bảng giám sát hoàn tiền (Refund Tracking):**
  - Tích hợp bảng "Hoàn tiền hủy hợp đồng / hủy lớp" tại:
    - **Admin → Quản lý Tài chính:** Giám sát toàn bộ tiến độ từng hợp đồng, mã lỗi phát sinh, số tiền hoàn trả và liên kết giao dịch blockchain (Sepolia Etherscan).
    - **Học viên / Gia sư → Quản lý Ví:** Xem các hồ sơ thuộc quyền hạn của mình; hiển thị rõ ràng số tiền hoàn về địa chỉ ví học viên.
  - Bảng tự động đồng bộ mỗi 15 giây, phân định 4 trạng thái tiến độ: Chờ duyệt (`WAITING_APPROVAL`), Chờ quyết toán (`WAITING_SETTLEMENT`), Chờ blockchain (`BLOCKCHAIN_PENDING`), và Hoàn tất (`COMPLETED`).

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
