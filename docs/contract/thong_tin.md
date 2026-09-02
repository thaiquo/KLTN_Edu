# TỔNG HỢP TOÀN BỘ THÔNG TIN & ĐIỀU KHOẢN HỢP ĐỒNG KÝ QUỸ THÔNG MINH (EDUCONNECT SMART CONTRACT ESCROW)

> **Mục đích:** Tài liệu này cào và tổng hợp 100% thông tin chi tiết, thông số kỹ thuật, quy tắc pháp lý và cơ chế hoạt động thực tế từ toàn bộ codebase hệ thống **EduConnect Marketplace & Smart Contract Escrow** (đối chiếu giữa Database PostgreSQL, Backend Spring Boot Microservices, Smart Contract Solidity và Frontend React Web3).  
> **Hướng dẫn sử dụng:** Anh/Chị có thể trực tiếp sao chép toàn bộ nội dung trong file này ra phần mềm **Microsoft Word (.docx)** để biên soạn mẫu Văn bản Hợp đồng Pháp lý chính thức cho Đồ án/Dự án.

---

## 1. THÔNG TIN HỢP ĐỒNG VÀ PHIÊN BẢN MẪU (CONTRACT METADATA & VERSIONING)

* **Tên loại Văn bản:** Hợp đồng Dịch vụ Kết nối Gia sư và Đào tạo Trực tuyến (Kèm Cơ chế Bảo vệ Quỹ Escrow Blockchain)
* **Phiên bản Hợp đồng (`contractVersion`):** Version 1.0 (Chuẩn `educonnect.escrow-terms.v1`)
* **Căn cứ Pháp lý Việt Nam:**
  * Bộ luật Dân sự số `91/2015/QH13` được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015.
  * Luật Giao dịch điện tử số `20/2023/QH15` ban hành ngày 22/06/2023 về Chữ ký số và Văn bản điện tử.
* **Mã định danh Hợp đồng:**
  * **Mã UUID Hệ thống:** Chuỗi 36 ký tự duy nhất (Ví dụ: `1d30dead-0000-0000-0000-000000000000`).
  * **Mã On-chain Hash (`bytes32 agreementId`):** Thuật toán Keccak-256 mã hóa chuỗi `EDUCONNECT:AGREEMENT:<uuid>` (Ví dụ: `0x4ce6daafa0a04d6fd8ede7f08a587f33bc7827b19b707f0d7db1c00299b42ead`).
  * **Terms Digest Hash (`termsHash`):** Mã SHA-3 / Keccak-256 băm toàn bộ cấu trúc dữ liệu JSON điều khoản hợp đồng gốc.
* **Hạ tầng Blockchain Deployment:**
  * **Mạng Blockchain:** Ethereum Sepolia Testnet (Mã Mạng `Chain ID: 11155111`).
  * **Địa chỉ Master Smart Contract Escrow:** `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`
  * **Địa chỉ Token Thanh toán (Mock USDC):** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (Số chữ số thập phân - `Decimals: 6`).

---

## 2. THÔNG TIN CÁC BÊN THAM GIA HỢP ĐỒNG (PARTIES IDENTIFICATION)

### 2.1. BÊN A: BÊN CUNG CẤP DỊCH VỤ GIA SƯ (TUTOR)
* **Họ và tên Gia sư:** [Họ tên thật lấy từ hồ sơ tài khoản `account-service`, Ví dụ: *Thái Huỳnh Ngọc Quốc*]
* **Email liên hệ chính thức:** [Email Gia sư đăng ký trên hệ thống, Ví dụ: *thaiquochuynhngoc.004@gmail.com*]
* **Số điện thoại liên lạc:** [Số điện thoại từ thông tin cá nhân, Ví dụ: *0733727345*]
* **Ngày tháng năm sinh (`dateOfBirth`):** [Ngày sinh từ hồ sơ tài khoản, Ví dụ: *02/01/1998*]
* **Giới tính (`gender`):** Nam / Nữ
* **Địa chỉ cư trú hiện tại:** [Số nhà, Đường, Phường/Xã (`ward`), Quận/Huyện (`district`), Tỉnh/Thành phố (`province`)]
* **Số Căn cước Công dân / CMND (`citizenId`):** [Mã số CCCD / CMND đã xác thực trên hệ thống]
* **Trình độ học vấn & Bằng cấp (`academicDegree` / `university`):** Cử nhân / Kỹ sư / Thạc sĩ (Đã thẩm định bằng cấp & chứng chỉ chuyên môn)
* **Mã định danh Hệ thống (`tutorId`):** Mã số tài khoản gia sư trong hệ thống.
* **Trạng thái Phê duyệt Hồ sơ (`tutorStatus`):** `APPROVED` (Đã được Ban quản trị EduConnect phê duyệt bằng cấp và minh chứng năng lực)
* **Địa chỉ Ví Web3 EVM nhận thù lao (`tutorWallet`):** Địa chỉ Ví MetaMask mạng Sepolia dạng Hex 42 ký tự (Ví dụ: `0x036d5016e5171224784d204e8d59805b1e5a8d27`).

### 2.2. BÊN B: BÊN SỬ DỤNG DỊCH VỤ HỌC TẬP (STUDENT / PARENT / GUARDIAN)
* **Họ và tên Học viên / Người giám hộ:** [Họ tên thật từ hồ sơ tài khoản, Ví dụ: *Thái Huỳnh Ngọc Quốc*]
* **Email liên hệ chính thức:** [Email Học viên đăng ký trên hệ thống, Ví dụ: *huynhngocquocthai.hkhk@gmail.com*]
* **Số điện thoại liên lạc:** [Số điện thoại từ thông tin cá nhân, Ví dụ: *0733727345*]
* **Ngày tháng năm sinh (`dateOfBirth`):** [Ngày sinh từ hồ sơ tài khoản, Ví dụ: *02/01/2011*]
* **Giới tính (`gender`):** Nam / Nữ
* **Trình độ / Khối lớp hiện tại (`grade`):** [Lớp/Khối học tập hiện tại của học viên]
* **Địa chỉ cư trú / Liên hệ:** [Số nhà, Đường, Phường/Xã (`ward`), Quận/Huyện (`district`), Tỉnh/Thành phố (`province`)]
* **Thông tin Người giám hộ (Dành cho Học viên dưới 18 tuổi):**
  * **Họ và tên Phụ huynh / Người giám hộ (`parentName`):** [Họ tên phụ huynh bảo lãnh]
  * **Số điện thoại Phụ huynh (`parentPhone`):** [Số điện thoại liên hệ khẩn cấp]
* **Mã định danh Hệ thống (`studentId`):** Mã số tài khoản học viên trong hệ thống.
* **Địa chỉ Ví Web3 EVM nạp cọc (`studentWallet`):** Địa chỉ Ví MetaMask mạng Sepolia dạng Hex 42 ký tự (Ví dụ: `0x6b8cd3961016f8549a827ba40e392d7a34f65d98`).

### 2.3. BÊN C: ĐƠN VỊ VẬN HÀNH NỀN TẢNG (EDUCONNECT PLATFORM & SMART ESCROW)
* **Tên đơn vị vận hành:** Nền tảng Giáo dục Thông minh Kết Nối Học (EduConnect Marketplace Platform System).
* **Đại diện kỹ thuật & Trọng tài:** Hệ thống Hợp đồng Thông minh Tự động Smart Contract Escrow & Ban Trọng tài Trực tuyến (Staff/Admin Arbitrator).
* **Địa chỉ Trụ sở & Kênh hỗ trợ:** Hệ thống trực tuyến EduConnect Platform, Email: `support@educonnect.vn`.
* **Địa chỉ Ví Thu phí Dịch vụ Nền tảng (`platformWallet`):** `0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`
* **Địa chỉ Smart Contract Escrow Master:** `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3` (Sepolia Chain ID: `11155111`).

---

## 3. NỘI DUNG KHÓA HỌC, HÌNH THỨC HỌC TẬP & PHỤ LỤC LỊCH HỌC TỪNG BUỔI (COURSE DETAILS & LEARNING MODES)

* **Tên Khóa học / Lớp học (`className`):** [Tên lớp học thật trên Marketplace, Ví dụ: *Toán lớp 2 (2026-001)*].
* **Mã Lớp học (`classroomId`):** Mã định danh số của lớp học trong hệ thống (`learning-service`).
* **Tổng số buổi học đào tạo (`totalSessions`):** Tổng số buổi theo chương trình (Ví dụ: `10 buổi` hoặc `12 buổi`).
* **Thời lượng mỗi buổi học (`durationPerSessionMinutes`):** 90 phút / buổi (hoặc theo khung giờ thỏa thuận 60 - 120 phút).
* **Hình thức Học tập (`learningMode`):** Hệ thống hỗ trợ 2 hình thức linh hoạt:
  1. **Hình thức Trực tuyến (`LearningMode.ONLINE`):**
     * Học trực tuyến 100% qua đường dẫn phòng học tích hợp Google Meet / Zoom / Teams (`meetingLink`). Bắt buộc khai báo liên kết phòng học cố định khi khởi tạo lớp.
  2. **Hình thức Trực tiếp / Tại nhà (`LearningMode.OFFLINE`):**
     * Gia sư đến dạy trực tiếp tại địa chỉ nhà Học viên hoặc địa điểm đào tạo đăng ký (`address`). Bắt buộc khai báo chi tiết địa chỉ khi khởi tạo lớp.
* **Cơ chế Điểm danh:** **Cơ chế Tự Điểm Danh Độc Lập (Independent Dual-Party Self Check-in)**.
  * **Học viên tự điểm danh:** Mỗi Học viên tự truy cập tài khoản cá nhân và chủ động nhấn nút *"Điểm danh có mặt"* cho từng buổi học của mình.
  * **Gia sư tự điểm danh:** Gia sư tự truy cập tài khoản và nhấn nút *"Điểm danh có mặt"* cho buổi dạy tương ứng.
  * **Ưu điểm:** Loại bỏ quy trình điểm danh rườm rà, tiết kiệm thời gian tối đa cho cả hai bên và đảm bảo tính độc lập dữ liệu.
  * **Kết hợp kết quả quyết toán:** Hệ thống tự động tổng hợp từ 2 thao tác tự điểm danh độc lập để xác định 1 trong 3 kịch bản:
    - *Cả 2 bên cùng tự điểm danh* ➔ Kết quả: **`BOTH_PRESENT`** (Cả hai có mặt).
    - *Gia sư tự điểm danh nhưng Học viên không điểm danh* ➔ Kết quả: **`STUDENT_ABSENT_TUTOR_PRESENT`** (Học viên vắng mặt).
    - *Gia sư không tự điểm danh* ➔ Kết quả: **`TUTOR_ABSENT`** (Gia sư vắng mặt).
* **Phụ lục Lịch trình (`schedules`):** Danh sách chi tiết các chương bài học (Chapters), khung giờ cố định trong tuần (Ví dụ: *Thứ 2, 4, 6 từ 18:00 đến 19:30*) và tài liệu kèm theo được lưu trữ công khai trên giao diện Lớp học của Hệ thống.

---

## 4. HỌC PHÍ, TY GIÁ QUY ĐỔI, PHÍ NỀN TẢNG & CƠ CHẾ KÝ QUỸ SMART CONTRACT ESCROW

### 4.1. Quy định Học phí & Tỷ giá Quy đổi Standard:
* **Tỷ giá quy đổi chuẩn cố định:** `1 USDC = 25.000 VNĐ` (`vndPerUsdc: 25000`).
* **Học phí mỗi buổi học (VNĐ):** Ví dụ: `25.000 VNĐ / buổi`.
* **Học phí mỗi buổi học quy đổi (USDC):** `$1.00 USDC / buổi` (`pricePerSessionUsdcUnits: 1000000` - 6 Decimals).
* **Tổng giá trị hợp đồng ký quỹ (VNĐ):** Ví dụ: `300.000 VNĐ` (cho 12 buổi).
* **Tổng giá trị hợp đồng ký quỹ (USDC):** `$12.00 USDC` (`totalAmountUsdcUnits: 12000000` - 6 Decimals).

### 4.2. Cơ chế Khóa Quỹ An Toàn (Escrow Locking Mechanism):
* Toàn bộ tổng tiền học phí `$12.00 USDC` của Bên B sẽ được nạp và **khóa an toàn vào Smart Contract Escrow ngay tại thời điểm khởi tạo hợp đồng**.
* Tiền học phí **KHÔNG CHUYỂN TRỰC TIẾP** cho Gia sư ngay từ đầu. Tiền chỉ được tự động cắt theo từng buổi học dựa trên kết quả tự điểm danh độc lập và hết thời hạn khiếu nại.

### 4.3. Phí Dịch vụ Nền tảng (Platform Protocol Fee):
* Phí duy trì nền tảng, kết nối và vận hành hệ thống trọng tài là **15% (1.500 basis points - bps)** tính trên giá trị mỗi buổi học hoàn tất thành công.
* Gia sư nhận **85% (8.500 bps)** thù lao thực nhận cho mỗi buổi dạy thành công.

---

## 5. QUY TẮC ĐIỂM DANH THỦ CÔNG VÀ 3 KỊCH BẢN GIẢI NGÂN TỰ ĐỘNG (MANUAL ATTENDANCE & 3-SCENARIO PAYOUT RULES)

Sau khi mỗi buổi học kết thúc, Gia sư thao tác điểm danh thủ công trên giao diện và phát hành yêu cầu quyết toán buổi học (`PROPOSED`). Hệ thống Smart Contract Escrow phân chia dòng tiền tự động theo **3 Kịch bản Chuẩn**:

```text
               +-------------------------------------------------------------+
               |                  BUỔI HỌC KẾT THÚC (PROPOSED)                 |
               +------------------------------+------------------------------+
                                              |
                     +------------------------+------------------------+
                     |                        |                        |
                     v                        v                        v
            [KỊCH BẢN 1: BOTH_PRESENT]  [KỊCH BẢN 2: STUDENT_ABSENT]  [KỊCH BẢN 3: TUTOR_ABSENT]
                     |                        |                        |
          +----------+----------+  +----------+----------+             v
          |                     |  |                     |        Hoàn 100% tiền
          v                     v  v                     v        về ví Học viên
      Gia sư: 85%         Nền tảng: 15% Gia sư: 45% Nền tảng: 10% (Tutor & Platform: 0%)
                                        (Học viên nhận lại: 45%)
```

### 📋 Bảng Chi Tiết Phân Chia Tỷ Lệ Giải Ngân (Basis Points - 10.000 bps = 100%):

| Kịch bản Buổi học | Trạng thái Điểm danh | Thù lao Gia sư (Tutor) | Phí Nền tảng (Platform) | Hoàn tiền Học viên (Refund) |
| :--- | :--- | :---: | :---: | :---: |
| **Kịch bản 1** | **Cả 2 bên có mặt** (`BOTH_PRESENT`) | **85%** (8.500 bps) | **15%** (1.500 bps) | **0%** |
| **Kịch bản 2** | **Học viên vắng mặt không phép** (`STUDENT_ABSENT`) | **45%** (4.500 bps) | **10%** (1.000 bps) | **45%** (4.500 bps) |
| **Kịch bản 3** | **Gia sư vắng mặt / Khiếu nại thành công** (`TUTOR_ABSENT` / `DISPUTE_REFUND`) | **0%** (0 bps) | **0%** (0 bps) | **100%** (10.000 bps) |

---

## 6. THỜI HẠN THANH TOÁN 24H, HẾT HẠN VÀ TỰ ĐỘNG GIẢI PHÓNG WAITLIST (PAYMENT WINDOW & WAITLIST RELEASE)

* **Cửa sổ Thanh toán 24 Giờ (`24h Payment Window - 86.400s`):**
  * Kể từ thời điểm Bên A (Gia sư) bấm ký và phê duyệt yêu cầu tham gia, hợp đồng chuyển sang trạng thái `WAITING_PAYMENT`.
  * Bên B (Học viên) có **chính xác 24 giờ** để truy cập ví MetaMask, thực hiện ký EIP-712 và nạp cọc USDC vào Smart Contract.
* **Cơ chế Hết hạn & Giải phóng Danh sách Chờ (`EXPIRED & Waitlist Auto-Release`):**
  * Nếu quá 24 giờ mà Bên B chưa hoàn tất việc nạp cọc, hợp đồng tự động chuyển trạng thái **`EXPIRED` (Hết hạn)**.
  * Suất đăng ký của Bên B lập tức bị hủy bỏ, hệ thống tự động giải phóng chỗ trống cho học viên tiếp theo trong **Danh sách chờ (`Waitlist Readiness`)** của lớp học.

---

## 7. QUY TRÌNH KHIẾU NẠI 24H (`DISPUTE WINDOW`) VÀ CƠ CHẾ XỬ LÝ LỖI (`TUTOR_FRAUD`)

* **Thời hạn Mở Khiếu nại (`Dispute Window`):** Trong vòng **24 giờ kể từ thời điểm Gia sư phát hành đề xuất quyết toán buổi học (`PROPOSED`)**, Học viên có quyền nhấn **"Tạo khiếu nại"** nếu thấy thông tin không đúng thực tế.
* **Các Loại Khiếu Nại Hợp Lệ:**
  1. **`TUTOR_FRAUD` (Gia sư gian lận):** Gia sư không xuất hiện, không dạy nhưng vẫn điểm danh có mặt hoặc ghi nhận thông tin sai lệch.
  2. **`QUALITY_COMPLAINT` (Chất lượng không đúng cam kết):** Gia sư kết thúc lớp quá sớm, không chuẩn bị bài hoặc vi phạm quy tắc ứng xử.
  3. **`STUDENT_ABSENT_PROTEST` (Tranh chấp điểm danh):** Học viên có mặt đúng giờ nhưng bị điểm danh vắng mặt.
* **Trạng thái Tranh chấp On-Chain (`DISPUTED`):**
  * Khi khiếu nại được tạo, tiền học phí của buổi học đó lập tức bị **phong tỏa trên Smart Contract**, cả Gia sư lẫn Nền tảng đều **không thể rút tiền**.
* **Cơ chế Phán quyết của Trọng tài Nền tảng (Platform Arbitrator):**
  * Ban Quản trị / Trọng tài EduConnect sẽ xem xét lịch sử phòng học, ghi âm/ghi hình, bằng chứng do 2 bên cung cấp trong vòng 48h.
  * **Nếu Khiếu nại ĐÚNG (Approved):** Chuyển kết quả sang `DISPUTE_REFUND`, hoàn lại **100% tiền buổi học** về ví Học viên.
  * **Nếu Khiếu nại SAI/Bất hợp lý (Rejected):** Bác bỏ khiếu nại, giải ngân tiền theo kịch bản chuẩn `BOTH_PRESENT` cho Gia sư.

---

## 8. QUYỀN VÀ NGHĨA VỤ CỦA HỌC VIÊN VÀ GIA SƯ (RIGHTS & OBLIGATIONS)

### 8.1. Quyền và Nghĩa vụ của Bên A (Gia sư):
* **Quyền lợi:**
  * Được đảm bảo nhận đúng **85% thù lao** cho các buổi dạy thành công thông qua Smart Contract Escrow mà không sợ bị quỵt tiền.
  * Được đền bù **45% học phí** nếu Học viên tự ý vắng mặt không báo trước.
* **Nghĩa vụ:**
  * Giảng dạy đầy đủ, đúng giờ, đúng lộ trình khóa học đã đăng ký.
  * Chuẩn bị giáo án, tài liệu và điểm danh trung thực sau mỗi buổi học.
  * Bảo mật thông tin cá nhân và hình ảnh của Học viên.

### 8.2. Quyền và Nghĩa vụ của Bên B (Học viên / Phụ huynh):
* **Quyền lợi:**
  * Được bảo hộ tiền học phí 100% trên Smart Contract, chỉ trả tiền cho những buổi học thực tế diễn ra đạt chất lượng.
  * Có quyền khiếu nại và nhận lại **100% tiền hoàn** nếu Gia sư bỏ giờ, nghỉ dạy không báo trước.
* **Nghĩa vụ:**
  * Thanh toán/Nạp cọc đúng hạn trong vòng 24 giờ kể từ khi hợp đồng được duyệt.
  * Tham gia lớp học đúng giờ, chuẩn bị bài và tuân thủ nội quy lớp học.

---

## 9. BẢO MẬT DỮ LIỆU CÁ NHÂN, QUYỀN GHI HÌNH VÀ TÀI LIỆU HỌC TẬP (DATA PRIVACY & IP RIGHTS)

* **Bảo mật Thông tin Cá nhân:** Mọi dữ liệu Họ tên, Email, Số điện thoại và Địa chỉ ví của các bên được lưu trữ bảo mật trên hệ thống Database PostgreSQL theo tiêu chuẩn an toàn thông tin.
* **Quyền Ghi hình Phòng học (Classroom Recording):** Buổi học trực tuyến trên nền tảng có thể được tự động ghi hình nhằm mục đích làm **minh chứng đối soát khi có tranh chấp/khiếu nại**. Dữ liệu ghi hình không được chia sẻ cho bên thứ ba ngoài mục đích xử lý khiếu nại.
* **Bản quyền Tài liệu Học tập:** Toàn bộ giáo án, tài liệu do Gia sư cung cấp thuộc quyền sở hữu trí tuệ của Gia sư và Nền tảng EduConnect. Học viên không được tự ý sao chép, thương mại hóa khi chưa có sự đồng ý.

---

## 10. HIỆU LỰC HỢP ĐỒNG, CHẤM DỨT VÀ QUY TẮC HỦY LỚP (EFFECTIVENESS & CANCELLATION)

* **Thời điểm Có hiệu lực (`ACTIVE`):** Hợp đồng chính thức có hiệu lực ràng buộc pháp lý ngay tại thời điểm giao dịch nạp cọc USDC của Bên B được xác nhận thành công trên mạng Sepolia Blockchain.
* **Quy tắc Hủy Lớp Ngang chừng (`CANCELLATION POLICY`):**
  * Chuẩn hủy lớp: `REFUND_UNUSED_AFTER_OPEN_SESSIONS_RESOLVED`.
  * Nếu một trong hai bên yêu cầu chấm dứt hợp đồng trước thời hạn: Tất cả các buổi học đã dạy hoặc đang khiếu nại phải được quyết toán xong. Số tiền cho **các buổi học chưa diễn ra sẽ được Smart Contract hoàn trả 100% về ví của Học viên**.

---

## 11. XÁC NHẬN ĐIỆN TỬ VÀ PHỤ LỤC CHỨNG CỨ MẬT MÃ HỌC EIP-712 (EIP-712 CRYPTOGRAPHIC PROOFS)

Hợp đồng này được khởi tạo và ký kết hoàn toàn bằng **Chữ ký số Điện tử Mật mã học chuẩn EIP-712 (EIP-712 Typed Data Standard)** thông qua Ví Web3 MetaMask.

### 11.1. Cấu trúc EIP-712 Domain Separator:
* `name`: `"EduConnectEscrow"`
* `version`: `"1"`
* `chainId`: `11155111` (Sepolia Testnet)
* `verifyingContract`: `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`

### 11.2. Phụ lục Bằng chứng Chữ ký Điện tử (Cryptographic Proof Summary):

```text
+-----------------------------------------------------------------------------------+
|                        BẰNG CHỨNG CHỮ KÝ ĐIỆN TỬ MẬT MÃ HỌC                        |
+-----------------------------------------------------------------------------------+
| 1. CHỮ KÝ BÊN A (GIA SƯ)                                                          |
|    - Người ký: Thái Huỳnh Ngọc Quốc                                               |
|    - Địa chỉ Ví Web3: 0x036d5016e5171224784d204e8d59805b1e5a8d27                   |
|    - Chữ ký Hex EIP-712: 0xafa88c690d46d3c0640417a3e2f0d8c568d6bb01c7820c802ad...  |
|    - Trạng thái: ĐÃ XÁC THỰC KÝ SỐ EIP-712                                        |
+-----------------------------------------------------------------------------------+
| 2. CHỮ KÝ BÊN B (HỌC VIÊN / PHỤ HUYNH)                                            |
|    - Người ký: Thái Huỳnh Ngọc Quốc                                               |
|    - Địa chỉ Ví Web3: 0x6b8cd3961016f8549a827ba40e392d7a34f65d98                   |
|    - Chữ ký Hex EIP-712 / Tx Hash: 0x7aaf23f64ce6daafa0a04d6fd8ede7f08a587f3...   |
|    - Trạng thái: ĐÃ XÁC THỰC KÝ QUỸ SMART CONTRACT ESCROW                         |
+-----------------------------------------------------------------------------------+
| 3. TỔNG THỂ TERMS DIGEST HASH (SHA-3 / Keccak-256):                               |
|    0xeb6ff34cd03097d557027be3d6b8726185b8b848f9f98d7e872234177ff8a0e7              |
+-----------------------------------------------------------------------------------+
```

---

*Văn bản hợp đồng điện tử này được trích xuất tự động và đồng bộ trực tiếp từ Cơ sở Dữ liệu PostgreSQL & Smart Contract Escrow của Hệ thống EduConnect Marketplace.*
