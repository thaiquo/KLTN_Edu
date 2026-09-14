# EduConnect — Thông tin kỹ thuật hợp đồng và escrow

> Đối chiếu source ngày **2026-09-14**. Đây là tài liệu kỹ thuật, không phải ý kiến pháp lý và không tự khẳng định hiệu lực pháp lý của mẫu hợp đồng/chữ ký tại một khu vực pháp lý cụ thể.

## 1. Kiến trúc

EduConnect dùng **Service-Based Architecture**. Contract Service chạy port 8083 và sở hữu agreement, acceptance, document artifact, escrow payment, settlement, dispute/evidence và blockchain audit projection.

## 2. Định danh và deployment

- Local agreement id: UUID.
- On-chain id: `keccak256("EDUCONNECT:AGREEMENT:" + uuid)` dưới dạng `bytes32`.
- Terms hash: Keccak-256 của canonical `terms_json`.
- Sepolia chain id: `11155111`.
- Escrow: `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3`.
- Circle Sepolia test USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`, 6 decimals.

Địa chỉ Student/Tutor/Platform thực tế lấy từ agreement/deployment config, không lấy từ ví dụ hard-code trong tài liệu.

## 3. Snapshot hợp đồng

`terms_json` chốt dữ liệu cần thiết tại thời điểm lập agreement, gồm:

- party identity snapshot dùng để hiển thị văn bản;
- Student/Tutor wallet;
- classroom, learning mode, schedule/chapter;
- học phí VND, tỷ giá tại thời điểm ký, USDC base units;
- total sessions, price per session và total escrow;
- settlement/dispute policy và version.

Sau khi ký, không sửa terms/wallet ngầm. Thay đổi điều khoản cần flow agreement/version mới có chủ đích.

## 4. EIP-712

Typed data hiện tại:

```text
Domain:
  name = "EduConnect Platform"
  version = "1"
  chainId = agreement.chainId
  verifyingContract = agreement.escrowContractAddress

ClassContract:
  contractId: string
  tutorAddress: address
  studentAddress: address
  totalAmountUsdc: uint256
  termsHash: bytes32
  createdAt: uint256
```

Frontend gọi `signTypedData`; backend tự dựng digest, recover signer và yêu cầu recovered address đúng wallet/role của agreement. Chữ ký EIP-712 không tốn gas; transaction register/fund là bước khác.

## 5. Artifact DOCX/PDF

- Template: `EDUCONNECT_HOP_DONG_TEMPLATE_V1.docx`.
- Render DOCX: poi-tl.
- Convert PDF: Gotenberg/LibreOffice.
- Storage: local hoặc S3; runtime hiện chọn S3.
- DB lưu object key, content type, hash, status và version.
- File chỉ được preview/download sau agreement authorization.

Không ghi Docx4j/OpenPDF nếu source hiện không dùng chúng.

## 6. Agreement lifecycle

Local lifecycle chính:

```text
DRAFT
→ PENDING_TUTOR_ACCEPTANCE
→ PENDING_STUDENT_ACCEPTANCE
→ PREPARING_BLOCKCHAIN
→ WAITING_PAYMENT
→ PAYMENT_CONFIRMING
→ ACTIVE
→ COMPLETED
```

Nhánh cuối: `EXPIRED` cho agreement chưa fund quá hạn; `CANCELLED` cho funded agreement được trọng tài hủy và hoàn phần chưa dùng.

On-chain lifecycle: `NONE → CREATED → FUNDED → COMPLETED|CANCELLED`, hoặc `CREATED → EXPIRED`.

## 7. Funding

1. Backend operator gọi `registerAgreement`.
2. Confirmed `AgreementRegistered` mở payment window on-chain.
3. Student gọi USDC `approve` và escrow `fundAgreement` đúng exact total amount.
4. Confirmed `AgreementFunded` mới kích hoạt agreement/enrollment.

Không chuyển USDC trực tiếp vào escrow. Raw transfer không phân bổ token cho agreement và V1 không có rescue/sweep.

## 8. Attendance và settlement

Tutor và Student tự điểm danh độc lập. Hết giờ, Learning tạo outcome và Contract proposal cho từng Student agreement:

| Outcome | Tutor | Platform | Student refund |
| --- | ---: | ---: | ---: |
| `BOTH_PRESENT` | 85% | 15% | 0% |
| `STUDENT_ABSENT_TUTOR_PRESENT` | 45% | 10% | 45% |
| `TUTOR_ABSENT` | 0% | 0% | 100% |

`TUTOR_ABSENT` bao gồm cả trường hợp hai bên cùng không điểm danh. Tỷ lệ tính theo base unit; phần dư làm tròn về Student.

## 9. Dispute

- 24 giờ tính từ confirmed `SessionSettlementProposed`, không phải trực tiếp từ giờ kết thúc buổi.
- Mỗi dispute giữ đúng `(agreementId, sessionId)`.
- Solidity V1 chỉ mở tutor-fraud dispute cho `BOTH_PRESENT`.
- Reason text bắt buộc; file evidence tùy chọn, tối đa 50 MB.
- Evidence file lưu S3 theo agreement/session/role; DB lưu SHA-256/metadata.
- Student-origin complaint: Tutor có 24 giờ phản hồi; Staff/Admin xử lý khi đã phản hồi hoặc sau hạn.
- Không có thời hạn cuối phân xử; tiền giữ đến confirmed resolution.
- Approve: refund 100%; reject: 85% Tutor + 15% Platform.

Các nhãn complaint nghiệp vụ rộng như “quality” có thể nằm trong nội dung reason, nhưng contract V1 không có nhiều enum on-chain riêng cho từng loại complaint.

## 10. Cancellation

`cancelAgreementAndRefundUnused` chỉ chạy khi funded agreement không còn open session. Smart contract hoàn `remainingAmount` cho Student; session đã settlement không bị hoàn lần hai.

## 11. Privacy

- Không ghi full agreement/PII/evidence lên public blockchain.
- Không mặc định rằng hệ thống tự ghi âm/ghi hình lớp học; source hiện chỉ cho người dùng tải evidence. Mọi recording tương lai cần consent/privacy policy riêng.
- Student không đọc Tutor-origin complaint hoặc Tutor-private evidence.
- Ví dụ tài liệu không được chứa PII/chữ ký thật của người dùng.

## 12. Runtime evidence và giới hạn

- Đã xác nhận payout `BOTH_PRESENT` 0.6 USDC thành 0.51/0.09 trên Sepolia.
- Đã xác nhận refund `TUTOR_ABSENT` 0.6 USDC cho Student.
- Bốn agreement raw-transfer lịch sử bị `legacy_excluded` và không được retry/đưa vào KPI.
- Runtime hiện một operator và một primary RPC; cần monitoring/gas/S3/backup cho production.

Chi tiết authoritative: [../BLOCKCHAIN.md](../BLOCKCHAIN.md) và [../BUSINESS_RULES.md](../BUSINESS_RULES.md).
