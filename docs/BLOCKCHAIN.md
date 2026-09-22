# EduConnect — Blockchain, Escrow và Dispute

> Cập nhật theo Solidity, backend, frontend và runtime evidence đến **2026-09-14**.  
> Chi tiết hardening lịch sử: [ESCROW_HARDENING_2026-09-12.md](ESCROW_HARDENING_2026-09-12.md).

## 1. Phạm vi và nguồn sự thật

Blockchain dùng để đăng ký agreement, giữ USDC, quyết toán theo buổi, hoàn tiền và phân xử tutor-fraud dispute. Solidity là nguồn sự thật cho ABI, role, deadline, tỷ lệ và on-chain state.

- Network vận hành hiện tại: Ethereum Sepolia (`11155111`).
- Gas asset: Sepolia ETH.
- Escrow asset: Circle Sepolia test USDC, 6 decimals.
- Solidity: `0.8.36`, OpenZeppelin AccessControl/Pausable/ReentrancyGuard/SafeERC20.
- Tooling: Foundry, Web3j backend, ethers.js/MetaMask/Reown Web.

Không mô tả ETH là tiền học phí. Không xem local status hoặc receipt đơn lẻ là bằng chứng tiền đã chuyển; authoritative financial transition cần event từ đúng escrow/chain được ingest.

## 2. Deployment hiện dùng

| Thành phần | Giá trị |
| --- | --- |
| Chain | Sepolia `11155111` |
| `EduConnectEscrow` | `0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3` |
| Test USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Operator/Arbitrator đã kiểm chứng | `0x10dd719B6a13e9d275990d706C2640ab6F1CA28e` |

Frontend defaults hiện khớp deployment Sepolia và artifact Anvil: local token `0x5fb...aa3`, local escrow `0xe7f...512`. `ESCROW_ABI` dùng `bytes32 agreementId/sessionId` và các signature hiện khớp `IEduConnectEscrow.sol`.

## 3. Smart contract V1

### Agreement

```text
NONE → CREATED → FUNDED → COMPLETED
                 └──────→ CANCELLED
CREATED → EXPIRED
```

Các hàm chính:

- `registerAgreement(bytes32,address,address,bytes32,uint256,uint256,uint32)` — OPERATOR.
- `fundAgreement(bytes32)` — chỉ Student wallet, đúng amount/allowance và trước payment deadline.
- `expireAgreement(bytes32)` — OPERATOR, sau deadline khi chưa fund.
- `cancelAgreementAndRefundUnused(bytes32,bytes32)` — ARBITRATOR, chỉ khi không có open session.
- `getAgreement(bytes32)` — view.

Raw ERC-20 `transfer` vào địa chỉ escrow **không phải funding**. Nó không gắn token vào agreement, không phát `AgreementFunded` và không bao giờ được dùng làm fallback.

### Session

```text
NONE → PROPOSED ──hết 24h──> SETTLED hoặc REFUNDED
           └──khiếu nại──> DISPUTED ──phân xử──> SETTLED hoặc REFUNDED
```

- `proposeSessionSettlement` mở deadline 24 giờ theo `block.timestamp`.
- `finalizeSession` chỉ chạy khi deadline đã qua và status vẫn `PROPOSED`.
- `openTutorFraudDispute` chỉ chấp nhận proposal `BOTH_PRESENT` trong deadline.
- `resolveTutorFraudDispute` chỉ ARBITRATOR và yêu cầu resolution hash.
- Agreement có `openSessions` để chặn hủy khi còn session chưa kết thúc.

## 4. Quy tắc tiền

| Outcome/final result | Tutor bps | Platform bps | Student refund |
| --- | ---: | ---: | ---: |
| `BOTH_PRESENT` | 8,500 | 1,500 | phần còn lại (thường 0%) |
| `STUDENT_ABSENT_TUTOR_PRESENT` | 4,500 | 1,000 | phần còn lại (thường 45%) |
| `TUTOR_ABSENT` | 0 | 0 | 100% |
| Dispute approved | 0 | 0 | 100% |
| Dispute rejected | 8,500 | 1,500 | phần còn lại |

Smart contract tính Tutor và Platform bằng integer division/floor, rồi gán toàn bộ phần base-unit còn lại cho Student. Luôn kiểm tra bảo toàn:

`sessionAmount = tutorAmount + platformAmount + studentRefund`.

## 5. Mô hình per-Student

Một lớp nhiều Student tạo nhiều agreement độc lập. Với cùng session sequence:

- Student A dispute → chỉ settlement của agreement A bị giữ.
- Student B không dispute → agreement B vẫn được finalize sau deadline.
- Refund/payout và lịch sử đều gắn `(agreementId, sessionId)`.

Không có cơ chế “một Student khiếu nại thì hoàn cả lớp” trong V1. Tutor vắng được Learning chốt `TUTOR_ABSENT` riêng cho từng attendance/agreement và mọi Student có agreement hợp lệ đều nhận refund của phần mình.

## 6. Off-chain/on-chain boundary

Off-chain lưu:

- user/profile/class/session/attendance;
- full `terms_json`, signature, artifact;
- transaction audit, settlement projection;
- dispute reason/response và evidence object metadata.

On-chain lưu compact hashes, wallet, amount, deadlines, agreement/session state và phát event. Không đưa PII, full contract text hoặc file evidence lên chain.

## 7. Funding flow

1. Hai bên ký EIP-712 off-chain; backend recover signer và đối chiếu ví.
2. Backend operator đăng ký agreement; chỉ event `AgreementRegistered` chuyển local sang `WAITING_PAYMENT`.
3. Student dùng MetaMask gọi USDC `approve(escrow, amount)` rồi `fundAgreement(bytes32)`.
4. Browser gửi txHash ở trạng thái confirmation-pending.
5. Contract event poller ingest confirmed `AgreementFunded` từ đúng chain/emitter/Student/amount.
6. Local agreement thành `ACTIVE`, escrow `LOCKED`, Learning enrollment thành `ENROLLED`.

Nếu browser submit txHash sau event ingest, API xử lý idempotent. Nếu gọi raw transfer, agreement không được active.

## 8. Attendance → settlement

1. Learning tự chốt session quá giờ thành một trong ba outcome.
2. Delivery worker gửi outcome theo từng Student tới internal Contract endpoint.
3. Contract chỉ chọn agreement operationally funded và queue `PROPOSE`.
4. `SessionSettlementProposed` confirmed tạo `PROPOSED` + on-chain `disputeDeadline`.
5. Không dispute: scheduler queue `FINALIZE` sau deadline.
6. `SessionSettled` confirmed cập nhật terminal status, exact amounts, remaining escrow, transaction history và notification.

24 giờ bắt đầu từ confirmed proposal, không phải giờ tan học hay lúc tạo DB row.

## 9. Dispute/evidence

- Student/Tutor chỉ mở trên agreement của mình; reason text bắt buộc, evidence file tùy chọn.
- Managed evidence hỗ trợ image/video/audio/PDF/TXT/Word/Excel tối đa 50 MB.
- Root runtime chọn S3; key: `disputes/{agreementId}/sessions/{sessionId}/{role}/{uuid}-{filename}`.
- PostgreSQL lưu submitted user/role, object key, content type, SHA-256 và timestamp.
- Content được stream qua authorized controller; Student không đọc Tutor-private evidence.
- Valid application request queue `OPEN_DISPUTE`; tiền được coi là on-chain disputed khi event `TutorFraudDisputeOpened` được xác nhận.
- Student-origin complaint cho Tutor 24 giờ phản hồi. Staff/Admin chỉ resolve sớm khi Tutor đã phản hồi, hoặc sau response deadline.
- Không có arbitration deadline; settlement giữ đến khi event resolution/settlement xác nhận.

Giới hạn V1: on-chain dispute chỉ cho `BOTH_PRESENT`. Muốn dispute các outcome khác phải thiết kế/deploy contract version mới và migrate có chủ đích.

## 9.1 Chấm dứt hợp đồng & Đề xuất hủy lớp học (Termination & Refund)

Mọi thao tác chấm dứt hợp đồng đơn phương (Student) hoặc đề xuất dừng giảng dạy & hủy lớp (Tutor) đều được bảo chứng bằng chữ ký số EIP-712 Typed Data:

- **Domain Name**: `EduConnect Platform` (version `1`)
- **Primary Type**: `TerminationRequest`
- **Type Structure**:
  ```solidity
  TerminationRequest(string contractId,bytes32 reasonHash,bool wholeClass,uint256 requestedAt)
  ```
- **Xác thực Backend (`Eip712VerificationService`)**:
  - `reasonHash`: Keccak-256 của chuỗi lý do text UTF-8 do người dùng nhập.
  - `wholeClass`: `false` đối với Học viên đơn phương hủy hợp đồng; `true` đối với Gia sư đề xuất hủy toàn bộ lớp.
  - `expectedWallet`: Đối chiếu `signerWallet` phục hồi từ chữ ký với `studentWallet` (nếu là Học viên) hoặc `tutorWallet` (nếu là Gia sư) đã chốt trên hợp đồng.
  - `requestedAt` phải nằm trong khoảng lệch tối đa 5 phút so với server; chữ ký đã dùng không được sử dụng lại.
  - Nếu chữ ký giả mạo, hoặc ví MetaMask không khớp ví hợp đồng, yêu cầu lập tức bị từ chối ở tầng backend.
- **Hold vận hành và thực thi On-chain**:
  - Khi tiếp nhận chữ ký, hệ thống giữ cutoff tại Learning và Contract nhưng chưa gửi giao dịch blockchain. Hold/release có trạng thái retry bền khi liên service tạm gián đoạn.
  - Sau Staff đề xuất và Admin phê duyệt (`APPROVE`), hệ thống giữ nguyên cutoff, chờ mọi settlement trước cutoff kết thúc rồi gọi `cancelAgreementAndRefundUnused(bytes32 agreementId, bytes32 resolutionHash)` qua Arbitrator.
  - Toàn bộ số dư ký quỹ chưa quyết toán (`remainingDeposit`) được Smart Contract hoàn trả trực tiếp về ví của học viên, và phát event `AgreementCancelled`.
  - Với Escrow V1, đề xuất hủy cả lớp (`wholeClass=true`) được thanh lý bằng nhiều transaction độc lập, có trạng thái/retry theo từng agreement; không mô tả nhầm là một batch transaction.

## 10. Backend transaction pipeline

Mỗi write là durable `blockchain_transaction` intent:

1. Tạo idempotency key/calldata hash.
2. Pessimistic lock và serialize transaction theo operator sender.
3. Kiểm tra operational funding/lifecycle.
4. Kiểm tra chain/role/gas khi startup; `eth_call` preflight trước ký.
5. Prepare ký, lưu nonce/expected hash/signed bytes.
6. Broadcast và watch receipt.
7. Poll escrow logs, deduplicate `processed_event`, rồi chuyển domain state. Định kỳ đối soát receipt của các transaction đã `CONFIRMED` để phục hồi event bị RPC bỏ sót; vẫn chống trùng theo `(chainId, transactionHash, logIndex)` và kiểm tra block hash.

Trạng thái transaction: `CREATED → DISPATCHING → SUBMITTED → CONFIRMED|FAILED`.

- Crash khi chưa prepare: stale watcher trả intent về queue sau timeout.
- Đã ký nhưng broadcast không chắc chắn: giữ cùng hash/nonce/signed bytes, dò receipt và có thể rebroadcast cùng bytes.
- Lỗi chắc chắn trước broadcast (`hash IS NULL`) tự retry sau cooldown 5 phút, tối đa 5 vòng audit; mỗi vòng dispatcher có tối đa 3 attempt mặc định.
- Confirmed revert hoặc unknown outcome không tự tạo intent mới mù vì có nguy cơ tốn gas/duplicate; Admin recovery API kiểm tra state trước retry.

## 11. Restart/catch-up

Yêu cầu runtime: `BLOCKCHAIN_ENABLED=true`, `BLOCKCHAIN_OPERATOR_ENABLED=true`, đúng address/keystore password source, RPC, role và ETH gas.

- Learning quét session quá giờ khi application ready và mỗi 60 giây.
- Learning gửi lại completed session chưa acknowledged sau initial 5 giây và mỗi 30 giây.
- Contract quét `PROPOSED` quá deadline sau initial 30 giây và mỗi 60 giây.
- Dispatcher/receipt watcher chạy mỗi 5 giây.

Nếu tất cả service tắt, không có giao dịch được gửi trong thời gian tắt. Sau restart worker đọc state bền vững và catch up. Dispute đang mở không bao giờ bị auto-finalize.

## 12. Operational funding và legacy quarantine

Agreement chỉ được settlement-eligible khi payment hash khớp `AGREEMENT_FUNDED` processed event trên đúng chain và escrow. Local `ACTIVE` không đủ.

Bốn agreement lịch sử đã raw-transfer tổng 38.4 test USDC nhưng không tồn tại đúng on-chain agreement được đánh dấu `legacy_excluded`. Các settlement liên quan là `EXCLUDED_LEGACY`; record lỗi được giữ audit nhưng không retry, không vào KPI và không cung cấp action tài chính.

V1 không có rescue/sweep cho excess raw-transfer balance; tài liệu không được hứa có thể phân bổ số token này.

## 13. Bằng chứng runtime

- Funding flow thật đã tạo `AgreementFunded` và kích hoạt agreement/enrollment.
- `BOTH_PRESENT` 0.6 USDC: tx `0xd835b8ae250b20141feb32d26eb081ca1a0d532c9c6780b9622812c91990dc2`, block `11688753`, payout 0.51 Tutor + 0.09 Platform.
- `TUTOR_ABSENT` 0.6 USDC: tx `0xf608981a95f001b0cc5bd338995bd2cb54cc4addcf35b15957e06536005a3ec1`, refund 0.6 Student.
- 35 Foundry unit/fuzz/invariant tests đã pass trong đợt hardening; isolated Anvil backend flow cũng đã pass.
- Ngày 2026-09-14, 14 test transaction/scheduler recovery pass; database không có actionable failed transaction và mọi completed Learning session đã được dispatch.

## 14. Giới hạn vận hành

- Một operator instance, chưa có distributed nonce/signer coordination.
- Một primary RPC, chưa có multi-provider failover.
- Sepolia/test USDC là môi trường thử nghiệm, không phải production mainnet accounting.
- Phải giám sát ETH gas, RPC, event cursor, failed intent, overdue proposal và S3.
- Không dùng `docker compose down -v` nếu muốn giữ PostgreSQL volume.

## 15. Smart contract V2 (Đã sẵn sàng mã nguồn & test, chưa deploy)

Phiên bản V2 đã được lập trình sẵn và lưu trữ song song với V1, hoàn toàn không ảnh hưởng hay thay đổi V1 đang chạy trên Sepolia:

- Mã nguồn: `blockchain/src/EduConnectEscrowV2.sol`, `blockchain/src/interfaces/IEduConnectEscrowV2.sol`
- Script triển khai: `blockchain/script/DeployEduConnectEscrowV2.s.sol`
- Kiểm thử: `blockchain/test/EduConnectEscrowV2.t.sol` (9/9 pass, 44/44 tổng số bài test pass 100%)

### Các tính năng nâng cấp trong V2:
1. **Token Rescue an toàn (`rescueERC20`)**:
   - Cho phép Admin rút lại token gửi nhầm hoặc lượng USDC thặng dư (surplus do chuyển nhầm không qua agreement).
   - Có cơ chế bảo vệ nghiêm ngặt: Biến trạng thái `totalEscrowLiability` tự động theo dõi tổng tiền USDC đang bị khóa cho các hợp đồng đang hoạt động. Admin không bao giờ có thể rút vào phần tiền ký quỹ này.
2. **Hủy hàng loạt (`batchCancelAgreementsAndRefundUnused`)**:
   - Cho phép hủy và hoàn tiền đồng loạt nhiều hợp đồng trong một giao dịch duy nhất khi một lớp học bị hủy toàn bộ, tiết kiệm đáng kể chi phí gas và thời gian xử lý của backend.
3. **Khiếu nại & Phân xử đa kịch bản (`openDispute` / `resolveDispute`)**:
   - Mở rộng phân xử linh hoạt không chỉ giới hạn ở `BOTH_PRESENT` như V1, mà cho phép khiếu nại cả trường hợp `STUDENT_ABSENT_TUTOR_PRESENT`, và Arbitrator có thể chỉ định outcome cuối cùng phù hợp với bằng chứng thực tế.
4. **Tương thích ngược 100%**:
   - Giữ nguyên toàn bộ các hàm V1 (`openTutorFraudDispute`, `resolveTutorFraudDispute`, `cancelAgreementAndRefundUnused`, `fundAgreement`, v.v.).

