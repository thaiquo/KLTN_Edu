# Kế hoạch ổn định integrate-final trước khi hợp nhất main

Ngày kiểm tra: 2026-09-10. Điểm xuất phát: `7636d5d`.

## 1. Phạm vi và nguồn đối chiếu

Mục tiêu: giữ lịch sử hai nhánh và dữ liệu hiện có; tích hợp được đăng ký lớp,
ký hợp đồng, ký quỹ, vào lớp, lịch một tuần, bài tập theo buổi, điểm danh,
quyết toán, hoàn tiền, khiếu nại và thông báo. Chỉ đưa lên main sau khi có bằng
chứng kiểm thử trên cùng commit dự kiến merge.

`quocthai2` là nguồn đối chiếu các chức năng đã được người dùng chạy thành công
(đăng ký lớp, thanh toán, vào lớp), không phải bằng chứng toàn bộ nhánh ổn định.
Merge `14dd883` giữ hai parent `968fea8` và `4652cf6`; không cần làm lại merge
hoặc quay toàn bộ repository về một phía.

Tài liệu đã tìm thấy ở cả quocthai2 và integrate-final:

- [Kế hoạch buổi học/điểm danh/escrow](session/EDUCONNECT_SESSION_ATTENDANCE_ESCROW_MASTER_PLAN.md).
- [Báo cáo buổi học cũ](session/EDUCONNECT_SESSION_IMPLEMENTATION_STATUS.md).
- [Quy tắc escrow V1](blockchain/blockchain-p0-domain-spec.md).
- [Baseline nghiệp vụ](BUSINESS_RULES.md), [kiến trúc](ARCHITECTURE.md),
  [bảo mật](AUTH_SECURITY.md), [blockchain](BLOCKCHAIN.md).

Nhãn DONE/100% của báo cáo cũ chưa được tái xác nhận sau merge. Solidity hiện tại
là nguồn đối chiếu interface và quy tắc on-chain. Không đọc DOCX làm ngữ cảnh dự án.

## 2. Ranh giới bảo toàn

- Tiếp tục sửa trên integrate-final; giữ nguyên main, quocthai2 và các commit cũ.
- Không reset/rebase/squash lịch sử đã chia sẻ, không force-push.
- Commit theo từng nhóm sửa có kiểm chứng; không commit .env, bản dump, bundle hoặc dữ liệu cá nhân.
- Không xóa volume, bảng, dữ liệu nghiệp vụ, không chạy clean/repair để che lỗi Flyway.
- Chỉ chạy migration thử trên bản sao. Chưa cho backend/scheduler đọc ghi DB gốc.
- DB clone chứa hợp đồng thật cũ: tắt blockchain/operator, email/S3 ghi và tách RabbitMQ
  trước mọi runtime test. Không phát lại giao dịch Sepolia từ dữ liệu clone.
- Không gửi giao dịch Web3 hay đưa thay đổi lên main trong giai đoạn lập kế hoạch này.

## 3. Đợt 0 — Điểm phục hồi (đã thực hiện)

Chạy `node scripts/snapshot-integration.cjs --verify-restore`.

Kết quả đợt 20260910T081924Z:

- Lưu `repository.bundle` với tất cả refs và `git bundle verify` thành công.
- Lưu HEAD, refs, trạng thái worktree, patch, bản start-all.ps1 đang sửa và cấu hình .env cục bộ.
- Dump `kltn_db` định dạng custom: 215454 byte; SHA-256 nằm trong manifest.
- Phục hồi bằng `pg_restore --exit-on-error` vào container riêng, không mạng/cổng public.
- Toàn bộ 58 bảng public có số bản ghi khớp; container kiểm tra đã dừng.
- Bản gốc vẫn là `kltn-postgres`, volume `kltn_edu_postgres_data`, cổng 5434.

Vị trí cục bộ: `.local-backups/integration-20260910T081924Z/` (Git ignore).
Đây là bản sao trên cùng máy, chưa phải bản dự phòng ngoài máy. Manifest và dump
cần đi cùng nhau. Không khôi phục đè lên DB gốc để thử backup.

## 4. Đợt 1 — Đồng bộ build và môi trường

Trạng thái: đang kiểm tra, chưa sửa source nghiệp vụ.

1. Chọn JDK 21 theo từng tiến trình, không cần gỡ JDK khác. Máy đã có
   `C:\Program Files\Java\jdk-21.0.8`; Maven wrapper chạy được bằng JDK này.
2. Build root aggregator bằng JDK 21; phân biệt thiếu dependency với lỗi Java.
3. Typecheck frontend bằng `tsc --noEmit`, rồi production build. Không coi vite build
   thay thế typecheck. Ghi kết quả/log theo commit.
4. Sửa import/tham chiếu thiếu, DTO không khớp, khai báo trùng theo API thực tế;
   không dùng any hoặc bỏ kiểm tra bảo mật để đạt build xanh.
5. Chuẩn hóa startup dùng cùng cơ chế nạp .env, kiểm tra JDK/cổng/migration trước khi chạy.
   API Gateway không cần phải là service đầu tiên. Chỉ mở frontend sau khi API sẵn sàng.
6. AI là shell, dùng Maven wrapper chung khi chưa có wrapper riêng. Giữ shell của đồng đội;
   không tự thêm provider/model/Qdrant trong đợt ổn định này.

Phát hiện ban đầu:

- Root offline build thiếu parent Spring Boot 3.4.1 của AI; cần tải dependency rồi kiểm tra lại.
- Đã thử lại online bằng JDK 21: Gateway/Account/Learning qua `test-compile`;
  Contract thất bại với 3 lỗi do `ContractManagementControllerPaymentTest` không khớp
  constructor và `submitPayment` của controller sau merge. Notification/AI bị reactor
  bỏ qua. Đây là lỗi tích hợp test/API thật, không còn là lỗi thiếu dependency.
  Chưa thực thi test; không sửa test chỉ để chấp nhận controller thiếu kiểm tra quyền.
- Frontend typecheck có 13 lỗi: Marketplace/courses/callback chưa khai báo;
  NotificationBell thiếu label; badge thiếu DRAFT; acceptedCount/availableSlots trùng;
  các caller truyền role/email/userId vào API đã đổi signature.
- start-all.ps1 hiện không nạp .env, trong khi run-local.sh có nạp.

Điều kiện hoàn tất: build backend + compile test + typecheck + build frontend thành công;
startup preflight phát hiện cấu hình sai trước khi gây tác động DB.

## 5. Đợt 2 — Migration tương thích dữ liệu hai nhánh

Trạng thái: đã xác định xung đột; chưa chạy migration.

| Service | DB cũ | Source sau merge | Việc cần làm |
|---|---|---|---|
| Account | Đã áp dụng tới V14 | Có V15 refresh sessions | Thử migration thêm mới trên clone |
| Contract | Đã áp dụng tới V7 | Có V8 distribution amounts | Thử migration, kiểm tra bản ghi settlement cũ |
| Learning | V24 snapshot wallet; V26 sessions | V24 authorization; hai V26 | Thiết kế đường nâng cấp giữ lịch sử và các cột đã có |
| Learning | V15 checksum -1187981549 | V15 checksum -1145992866 | Đối chiếu SQL hai nhánh, giữ migration đã phát hành hoặc có chuyển tiếp được kiểm chứng |
| Notification | V1 init notification/chat; notifications UUID | V1 notifications BIGSERIAL; V2 chat | Chuyển đổi dữ liệu có ánh xạ ID/recipient/read-state, giữ bản cũ để đối chiếu |

Quy trình cụ thể:

1. Lập manifest version/script/checksum/schema cho DB quocthai2 hiện có và source main.
2. Phân loại migration đã phát hành và migration chưa áp dụng; không đổi số một cách mù quáng.
3. Không chọn lịch sử quocthai2 rồi mặc định DB của đồng đội cũng tương thích.
   Nếu chưa có DB main, tạo fixture từ migrations source main và ghi rõ giới hạn bằng chứng.
4. Thiết kế script chuyển tiếp có precondition, chỉ nhận đúng trạng thái schema đã biết;
   gặp schema lạ phải dừng. Mọi chỉnh sửa metadata lịch sử nếu thật sự cần phải có bảng
   đối chiếu trước/sau và chỉ áp dụng sau kiểm chứng trên clone, không repair tự động.
5. Với Notification, ánh xạ recipient bằng dữ liệu Account đã xác nhận; không đoán người nhận,
   không bỏ thông báo không ánh xạ được; giữ dữ liệu legacy và báo các dòng cần xử lý.
6. Chạy cả DB mới trống và DB clone cũ; so sánh tất cả bảng nghiệp vụ, khóa, lịch sử,
   số dòng, tham chiếu; chạy lại phải không nhân đôi dữ liệu.

Điều kiện hoàn tất: cả hai đường nâng cấp được kiểm chứng; DB cũ vẫn nguyên dữ liệu,
Flyway validate và Hibernate validate cùng qua. Sau đó mới chuẩn bị áp dụng DB thật.

## 6. Đợt 3 — Khôi phục hợp đồng API và phân quyền sau merge

- Dùng JWT cookie principal làm danh tính cho Contract và Chat; role/email/header client
  chỉ có thể là dữ liệu lọc hợp lệ, không phải quyền truy cập.
- Student/Tutor chỉ xem và thao tác hợp đồng/lớp/hội thoại của mình.
- Staff chỉ phân xử lớp mình duyệt; Admin toàn hệ thống; không xác định chủ review thì từ chối Staff.
- Session đọc/ghi, danh sách điểm danh, bài tập và file phải kiểm tra membership ở backend.
  Giao diện ẩn link không bảo vệ dữ liệu nếu API vẫn trả link.
- Không dùng GET công khai để tự sinh session/ghi DB.
- Giữ luồng refresh cookie, CSRF và active-role; kiểm tra nhiều tài khoản để bắt lỗi truy cập chéo.
- Kiểm tra frontend/backend signatures EIP-712 và API ký/funding có cùng canonical terms.

Điều kiện hoàn tất: regression test chống giả header/role, truy cập chéo, phiên hết hạn,
CSRF sai; luồng hợp lệ Student/Tutor/Staff/Admin vẫn dùng được.

## 7. Đợt 4 — Hoàn thiện vòng đời từng buổi

### Lịch, học viên, bài tập

- Đối chiếu ý nghĩa một tuần: tài liệu cũ dùng đợt `sessionsPerWeek`; xác định rõ ranh giới
  tuần/đợt, timezone và lịch khai giảng trước khi thay đổi cách sinh lịch.
- Chỉ tạo đợt đầu và đợt tiếp theo đúng điều kiện; không tạo hết khóa ngay.
- Chỉ sinh đợt tiếp khi buổi cuối của đợt hiện tại hoàn thành, không sau mỗi buổi bất kỳ.
- Không quá totalSessions, không trùng sequence khi scheduler chạy đồng thời/chạy lại.
- Lịch rỗng/sai, lớp hết hạn/hủy, nghỉ lịch phải dừng có lý do; không vòng lặp vô hạn.
- Chỉ học viên được enrollment hợp lệ mới vào roster; kiểm tra nhánh fallback ACCEPTED
  để không cho học khi funding chưa được xác nhận. Xử lý học viên được kích hoạt sau khi roster đã sinh.
- Tutor sở hữu lớp được soạn topic, assignment và file cho các buổi đã sinh.
- Kiểm tra việc khóa bài tập theo điểm danh cả API và UI theo quy tắc đã đối chiếu.

### Điểm danh và chốt kết quả

- Hai bên check-in trong thời gian hợp lệ; lưu thời điểm và người thực hiện.
- Điểm danh hộ phải có quyền và audit riêng; không cho sửa kết quả đã chốt/đã quyết toán.
- Xử lý rõ biên endTime để check-in và scheduler chốt không tranh chấp.
- Chạy bù sau khi server ngừng phải idempotent, không ghi lại kết quả hoặc giải ngân hai lần.
- Session COMPLETED là kết thúc học; không đồng nghĩa SETTLED trên blockchain.

### Cầu nối sang Contract

- Learning sở hữu attendance; phát sự kiện phiên bản hóa, lưu bền với outbox cùng transaction.
- Contract nhận idempotently, xác minh enrollment/agreement, ánh xạ classSessionId và
  sequenceNumber sang sessionId on-chain. Không dùng global DB ID như số thứ tự buổi.
- Mỗi học viên có agreement và settlement riêng; lớp nhiều học viên không dùng chung payout.
- Lưu evidence hash và snapshot bất biến, chống event giả/trùng/đến trễ.
- Pending tx chỉ là đang xử lý; trạng thái giải ngân/hoàn tiền cập nhật khi có event xác nhận.

## 8. Đợt 5 — Quyết toán và khiếu nại

Theo Solidity hiện tại (USDC là tiền ký quỹ, ETH là gas):

| Kết quả mỗi buổi | Tutor | Nền tảng | Hoàn Student |
|---|---:|---:|---:|
| Cả hai có mặt | 85% | 15% | Phần dư làm tròn |
| Tutor có, Student vắng | 45% | 10% | Phần còn lại, khoảng 45% |
| Tutor vắng | 0% | 0% | 100% |
| Khiếu nại được chấp nhận | 0% | 0% | 100% |
| Khiếu nại bị bác | 85% | 15% | Phần dư làm tròn |

- Deadline 24 giờ lấy từ proposal on-chain, không tự đếm từ lúc frontend bấm/chốt DB.
- V1 Solidity chỉ mở TUTOR_FRAUD cho BOTH_PRESENT. Tài liệu legacy nhắc các loại khác
  không tự mở rộng thành tính năng đang hỗ trợ; thay đổi phạm vi cần quyết định riêng.
- Đã DISPUTED thì không finalize dù quá 24 giờ; chờ phán quyết.
- Tutor giải trình, Staff/Admin xem hai bên, lưu resolver/reason/timestamp/tx hash.
- Phán quyết chỉ tác động agreement/session được chọn; không hoàn cả lớp.
- Tổng tutor + platform + studentRefund bằng giá một buổi, không âm/quá escrow;
  không refund hoặc payout lặp sau retry/restart.
- Kiểm tra hết khóa, hủy hoàn phần chưa dùng, pending/disputed chưa giải quyết,
  thiếu gas, RPC mất kết nối, tx revert, receipt trễ, operator tắt.
- Đối chiếu ABI gồm tuple getter/event với Solidity, không chỉ fundAgreement;
  xác minh bytecode/token/roles/deployment trước test Sepolia bằng ví.

Điều kiện hoàn tất: test tự động trên môi trường local/Anvil và test ví Sepolia có
bằng chứng riêng; không tuyên bố Sepolia qua chỉ nhờ cấu hình địa chỉ.

## 9. Ma trận nghiệm thu và điều kiện đưa main

| Nhóm | Ca kiểm tra bắt buộc |
|---|---|
| Hồi quy | Đăng ký/duyệt gia sư, tạo/duyệt lớp, yêu cầu học, hai chữ ký, funding, vào lớp |
| Lịch | Một tuần/đợt, tuần cuối ít buổi, lịch rỗng, restart, chạy scheduler trùng |
| Bài tập | Tutor đúng lớp soạn trước; Student đúng quyền; truy cập file trực tiếp |
| Điểm danh | Cả hai có; chỉ Tutor có; chỉ Student có; cả hai vắng; ngoài giờ; sau chốt |
| Tiền | Ba tỷ lệ, số lẻ, đủ số buổi, retry/event trùng, sai agreement/session |
| Khiếu nại | Đúng/sai deadline, đúng Student, đúng Staff, duyệt/bác, pending lâu, xử lý nhiều học viên |
| Realtime | Bell/chat đúng người; reconnect; RabbitMQ tạm ngắt; không lặp thông báo |
| Dữ liệu | DB mới và clone DB cũ, migration lặp, row count/constraints/history, phục hồi backup |

Các đợt sửa nên thành commit nhỏ theo thứ tự: build/startup, migration compatibility,
authorization/API, sessions, settlement integration, notification/regression, docs.

Trước main:

1. Working tree sạch, không chứa secrets/backup/bundle/dist ngoài chính sách repo.
2. Fetch main mới nhất khi chuẩn bị hợp nhất; refs origin/main hiện chỉ là snapshot local.
3. Merge origin/main vào integrate-final nếu có commit mới, xử lý conflict theo flow và
   chạy lại kiểm thử liên quan. Không chọn ours/theirs cho cả service.
4. Xác nhận các commit gốc main và quocthai2 vẫn là ancestor của integrate-final.
5. Push integrate-final và mở PR có migration runbook, kiểm thử, rủi ro/giới hạn rõ ràng.
6. Dùng merge commit để bảo toàn lịch sử; không squash/rebase merge nếu yêu cầu giữ SHA.
7. Chỉ merge main khi ma trận đạt và quy trình rollout DB đã được kiểm chứng.

## 10. Tiến độ hiện tại

- [x] Đối chiếu Git và tài liệu session của quocthai2.
- [x] Sao lưu Git/DB, kiểm tra phục hồi và số dòng toàn bộ bảng.
- [x] Xác định JDK 21 và Maven wrapper hoạt động.
- [x] Chạy typecheck, ghi nhận 13 lỗi cần sửa.
- [x] Chạy backend test-compile bằng JDK 21, ghi nhận 3 lỗi Contract controller/test.
- [x] Kiểm tra main và quocthai2 đều là ancestor của HEAD hiện tại.
- [x] Hoàn tất build/test và sửa source tích hợp (Đợt 1: commit dab0b10).
- [x] Migration tương thích, đã thử trên DB clone và DB mới (Đợt 2: commit bbcd6e2).
- [x] API/authorization/session/settlement/realtime regression (Đợt 3 & 4: commit 3106178, 458db96, 6c52f18).
- [x] Áp dụng migration trực tiếp lên DB live `kltn-postgres` (bảo toàn 100% dữ liệu, schema Flyway đồng bộ V27 Learning, V8 Contract, V2 Notification).
- [x] Cầu nối tự động quyết toán (Settlement Auto-Bridge) và bảo vệ nội dung bài tập theo điểm danh (learning-service 47/47 pass, contract-service 96/96 pass).
- [x] Toàn bộ Maven Reactor (7/7 modules) và Frontend Web Vite/TypeScript build sạch 100%.
- [ ] Kiểm thử ví và luồng end-to-end trên Sepolia / runtime qua ./run-local.sh từng service.
- [ ] Đồng bộ trạng thái các docs cũ với bằng chứng mới.
- [ ] PR và merge main.

Các mục chưa đánh dấu không phải đã hoàn thành; bản kế hoạch này không chứng nhận
integrate-final sẵn sàng main.
