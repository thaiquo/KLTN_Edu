# EDUCONNECT - MASTER PLAN TRIỂN KHAI HỢP ĐỒNG WORD/PDF

> Tài liệu điều phối triển khai từ mẫu Word đến hợp đồng PDF, ký EIP-712, lưu trữ và hiển thị trên React.
>
> Tài liệu nguồn nghiệp vụ: thong_tin(1).md  
> Mẫu Word: EDUCONNECT_HOP_DONG_TEMPLATE_V1.docx  
> Tiêu đề: HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC VIÊN

---

## 1. MỤC TIÊU CUỐI CÙNG

Sau khi hoàn thành kế hoạch, hệ thống phải:

1. Lấy dữ liệu Agreement, lớp học, gia sư, học viên, lịch học, giá tiền và blockchain từ PostgreSQL.
2. Tạo snapshot điều khoản bất biến cho đúng Agreement.
3. Chuẩn hóa snapshot và tính termsHash bằng Keccak-256.
4. Điền snapshot vào mẫu Word bằng poi-tl.
5. Chuyển DOCX sang PDF ở backend.
6. Hiển thị đúng PDF đó trên React.
7. Gia sư và học viên ký đúng termsHash bằng EIP-712/MetaMask.
8. Backend xác minh chữ ký, ví, role, nonce và deadline.
9. Tạo bản hợp đồng cuối có bằng chứng chữ ký.
10. Lưu DOCX/PDF vào object storage và metadata vào PostgreSQL.
11. Cho người có quyền xem và tải lại đúng file đã chốt.
12. Không dựng lại hợp đồng đã ký từ dữ liệu live đã thay đổi.

### Kết quả bắt buộc

- Một Agreement có đúng một snapshot cho mỗi contractVersion.
- Bản xem và bản tải xuống dùng cùng một file PDF.
- PDF chính thức sinh phía server, không dùng html2canvas/html2pdf.
- Sau khi ký, điều khoản không được thay đổi âm thầm.
- ONLINE hiển thị meetingLink.
- OFFLINE hiển thị learningAddress.
- Không còn placeholder dạng {{...}} trong file phát hành.
- Chữ ký EIP-712 recover đúng ví đã đăng ký.
- finalPdfSha256 lưu bên ngoài PDF, không chèn hash của chính PDF vào PDF.

---

## 2. NGUYÊN TẮC KHÔNG ĐƯỢC PHÁ VỠ

### 2.1. Một nguồn dữ liệu chính

- PostgreSQL và trạng thái Smart Contract là nguồn dữ liệu nghiệp vụ.
- Word chỉ là template trình bày, không chứa logic tính tiền.
- React chỉ hiển thị/gửi yêu cầu ký, không tự quyết định giải ngân.
- Smart Contract thực thi khóa, chia và hoàn Mock USDC.

### 2.2. Snapshot bất biến

Khi chuẩn bị ký, backend đọc dữ liệu hiện tại, tạo ContractTermsSnapshotV1, chuẩn hóa JSON, tính termsHash và lưu cả JSON/hash.

Sau đó mọi DOCX/PDF và payload EIP-712 phải dùng snapshot đã lưu. Không đọc lại giá, lịch, ví hoặc tên lớp từ bảng live để thay đổi hợp đồng đã ký.

### 2.3. Không dùng số thực cho tiền

- USDC lưu bằng smallest units.
- Mock USDC có 6 decimals.
- 1.00 USDC = 1000000 units.
- 8500 bps = 85%; 1500 bps = 15%.
- Không dùng float/double cho tiền, tỷ lệ hoặc dữ liệu hash.

### 2.4. Phân biệt hash

| Trường | Nội dung được băm | Nơi lưu/hiển thị |
| --- | --- | --- |
| agreementKey | EDUCONNECT:AGREEMENT:<uuid> | DB, chain, phụ lục |
| termsHash | Canonical JSON của điều khoản | DB, EIP-712, PDF |
| signatureBundleHash | termsHash + signer + chữ ký + thời điểm + fundingTxHash | DB và PDF |
| finalPdfSha256 | Byte file PDF cuối | DB/object metadata/trang xác minh; không chèn lại vào PDF |

---

## 3. KIẾN TRÚC ĐỀ XUẤT

Không tạo microservice mới nếu service quản lý Agreement đã đủ trách nhiệm. Đặt module hợp đồng trong service sở hữu Agreement, ví dụ learning-service hoặc agreement-service sau khi audit.

~~~mermaid
flowchart TD
    UI["React Contract UI"] --> API["Agreement/Contract API"]
    API --> DB["PostgreSQL: snapshot + signatures"]
    API --> DOC["poi-tl DOCX renderer"]
    DOC --> PDF["Gotenberg/LibreOffice"]
    PDF --> STORE["Object storage"]
    API --> CHAIN["Escrow + EIP-712"]
~~~

| Thành phần | Trách nhiệm |
| --- | --- |
| React | Xem PDF, tải file, gọi MetaMask ký |
| Agreement service | Kiểm tra quyền, snapshot, điều phối trạng thái |
| Document module | Điền Word, chuyển PDF, lưu file |
| Signature module | Typed data, nonce, deadline, recover signer |
| PostgreSQL | Snapshot, metadata, chữ ký, audit |
| Object storage | DOCX/PDF |
| Smart Contract | Ký quỹ, settlement, dispute, refund |

---

## 4. TRẠNG THÁI

Có thể giữ enum Agreement hiện tại và tạo enum riêng cho tài liệu.

~~~mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> TERMS_FROZEN
    TERMS_FROZEN --> PARTIALLY_SIGNED
    PARTIALLY_SIGNED --> FULLY_SIGNED
    FULLY_SIGNED --> FINALIZED
~~~

DocumentStatus đề xuất:

- DRAFT
- TERMS_FROZEN
- PARTIALLY_SIGNED
- FULLY_SIGNED
- FINALIZING
- FINALIZED
- FAILED
- SUPERSEDED

FINALIZED chỉ được đặt sau khi DOCX/PDF cuối đã lưu thành công.

---

## 5. BẮT ĐẦU TỪ ĐÂU

### 5.1. Tạo nhánh

~~~powershell
git status
git switch -c feature/contract-document-pipeline
~~~

Nếu working tree có thay đổi, không reset hoặc xóa. Ghi lại file đang sửa và tránh đụng phần không liên quan.

### 5.2. Chép tài liệu vào repository

~~~text
docs/
  contracts/
    EDUCONNECT_CONTRACT_IMPLEMENTATION_MASTER_PLAN.md
    thong_tin.md

<agreement-service>/
  src/main/resources/
    contract-templates/
      educonnect-contract-v1.docx
~~~

~~~powershell
New-Item -ItemType Directory -Force docs/contracts
New-Item -ItemType Directory -Force <agreement-service>/src/main/resources/contract-templates
Copy-Item <download-folder>/EDUCONNECT_CONTRACT_IMPLEMENTATION_MASTER_PLAN.md docs/contracts/
Copy-Item <download-folder>/thong_tin(1).md docs/contracts/thong_tin.md
Copy-Item <download-folder>/EDUCONNECT_HOP_DONG_TEMPLATE_V1.docx <agreement-service>/src/main/resources/contract-templates/educonnect-contract-v1.docx
~~~

Không dùng đường dẫn tuyệt đối máy lập trình trong code runtime.

---

## 6. PHASE 0 - AUDIT CODEBASE, CHƯA SỬA CODE

### Mục tiêu

Xác định service sở hữu Agreement, entity/table, enum, field thật, EIP-712, blockchain client, storage, migration và frontend hiện tại.

### Lệnh audit từ root repository

~~~bash
rg --files -g "pom.xml" -g "build.gradle*" -g "package.json" -g "docker-compose*.yml" -g "application*.yml" -g "application*.properties"
rg -n "class Agreement|record Agreement|interface Agreement|enum AgreementStatus" .
rg -n "WAITING_PAYMENT|ACTIVE|EXPIRED|PROPOSED|DISPUTED|DISPUTE_REFUND|RESOLVED_TUTOR_PAYMENT" .
rg -n "termsHash|agreementKey|agreementId|EIP712|signTypedData|eth_signTypedData_v4" .
rg -n "fundAgreement|registerAgreement|propose|resolveDispute|EduConnectEscrow" .
rg -n "Flyway|Liquibase|db/migration|changelog" .
rg -n "S3|MinIO|ObjectStorage|MultipartFile|FileStorage" .
rg -n "react-pdf|PDFViewer|docx-preview|html2pdf|iframe" .
~~~

### Đầu ra Phase 0

- Sơ đồ service/module.
- Entity/table và endpoint liên quan.
- Enum và transition hiện tại.
- Mapping thong_tin.md sang field code thật.
- Xung đột tài liệu/code.
- Service sẽ sở hữu contract-document.
- Danh sách file dự kiến tạo/sửa.
- Lệnh build/test hiện có.
- Không sửa file trong Phase 0.

### Prompt AI - Phase 0

~~~text
Bạn đang làm Phase 0 của tính năng hợp đồng Word/PDF cho EduConnect.

Đọc:
1. docs/contracts/EDUCONNECT_CONTRACT_IMPLEMENTATION_MASTER_PLAN.md
2. docs/contracts/thong_tin.md
3. Mẫu Word trong resources
4. Code Agreement, classroom, schedules, attendance, payment, dispute, Web3, Solidity và frontend

Chỉ AUDIT, tuyệt đối chưa sửa code.

Hãy xác định service sở hữu Agreement; entity/repository/service/controller/migration;
đối chiếu placeholder Word với field thật; tìm luồng EIP-712, Escrow và storage;
ghi rõ điểm thiếu/mâu thuẫn/rủi ro; đề xuất file sẽ sửa theo từng phase và lệnh test.

Không đoán class/table. Mọi kết luận kèm đường dẫn file và symbol.
Kết thúc bằng báo cáo Phase 0 rồi dừng.
~~~

---

## 7. PHASE 1 - DATABASE VÀ DOMAIN

Không sao chép toàn bộ Agreement/lớp/user/payment vào bảng mới. Chỉ lưu snapshot, hash, metadata, chữ ký, object key và trạng thái.

### Migration tham khảo

AI phải đổi kiểu agreement_id/account_id theo code thật.

~~~sql
CREATE TABLE contract_document (
    id UUID PRIMARY KEY,
    agreement_id UUID NOT NULL,
    contract_version VARCHAR(64) NOT NULL,
    template_key VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    terms_snapshot JSONB NOT NULL,
    terms_hash VARCHAR(66) NOT NULL,
    signature_bundle_hash VARCHAR(66),
    draft_docx_object_key VARCHAR(512),
    draft_pdf_object_key VARCHAR(512),
    final_docx_object_key VARCHAR(512),
    final_pdf_object_key VARCHAR(512),
    final_pdf_sha256 VARCHAR(64),
    failure_code VARCHAR(64),
    failure_message TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    finalized_at TIMESTAMPTZ,
    row_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_contract_document_agreement_version
        UNIQUE (agreement_id, contract_version)
);

CREATE INDEX idx_contract_document_agreement
    ON contract_document (agreement_id);

CREATE INDEX idx_contract_document_status
    ON contract_document (status);

CREATE TABLE contract_signature (
    id UUID PRIMARY KEY,
    contract_document_id UUID NOT NULL REFERENCES contract_document(id),
    signer_role VARCHAR(16) NOT NULL,
    signer_account_id UUID NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    recovered_address VARCHAR(42) NOT NULL,
    typed_data JSONB NOT NULL,
    signature_hex TEXT NOT NULL,
    nonce VARCHAR(78) NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL,
    verification_status VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_contract_signature_role
        UNIQUE (contract_document_id, signer_role),
    CONSTRAINT ck_contract_signature_role
        CHECK (signer_role IN ('TUTOR', 'STUDENT', 'GUARDIAN'))
);

CREATE INDEX idx_contract_signature_document
    ON contract_signature (contract_document_id);
~~~

Domain đề xuất:

~~~text
ContractDocument
ContractSignature
ContractDocumentStatus
ContractSignerRole
ContractTemplateRegistry
ContractTermsSnapshotV1
ContractArtifact
~~~

### Hoàn thành Phase 1

- Migration chạy trên DB sạch và DB hiện có.
- Unique constraint chống trùng version.
- Không lưu binary trong PostgreSQL.
- Entity có optimistic locking.
- Repository/integration test PASS.

### Prompt AI - Phase 1

~~~text
Triển khai Phase 1 theo master plan và báo cáo Phase 0.

Tạo migration contract_document/contract_signature bằng đúng kiểu khóa của project.
Tạo entity, enum, repository, mapper tối thiểu.
Không sửa payout, dispute hoặc Solidity.
Không lưu DOCX/PDF trong PostgreSQL.
Thêm unique constraint, optimistic locking và repository test.

Trước khi sửa, liệt kê file dự kiến.
Sau khi sửa, báo cáo file, lệnh test và kết quả.
Dừng sau Phase 1.
~~~

---

## 8. PHASE 2 - SNAPSHOT VÀ TERMS HASH

### Snapshot mẫu

~~~json
{
  "schema": "educonnect.escrow-terms.v1",
  "contractVersion": "1.0",
  "contractNo": "EDU-2026-000001",
  "agreementUuid": "1d30dead-0000-0000-0000-000000000000",
  "agreementKey": "0x...",
  "createdAt": "2026-09-01T14:30:00Z",
  "contractPlace": "Hệ thống EduConnect",
  "tutor": {
    "accountId": "...",
    "fullName": "...",
    "email": "...",
    "phone": "...",
    "address": "...",
    "status": "APPROVED",
    "wallet": "0x..."
  },
  "student": {
    "accountId": "...",
    "fullName": "...",
    "email": "...",
    "phone": "...",
    "dateOfBirth": "2011-01-02",
    "grade": "...",
    "address": "...",
    "wallet": "0x..."
  },
  "guardian": null,
  "course": {
    "classroomId": "...",
    "className": "Toán lớp 2",
    "totalSessions": 12,
    "durationPerSessionMinutes": 90,
    "learningMode": "ONLINE",
    "meetingPlatform": "Google Meet",
    "meetingLink": "https://...",
    "learningAddress": null,
    "courseStartDate": "2026-09-10",
    "courseEndDate": "2026-11-30",
    "sessions": []
  },
  "pricing": {
    "vndPerUsdc": 25000,
    "pricePerSessionVnd": 25000,
    "pricePerSessionUsdcUnits": 1000000,
    "totalAmountVnd": 300000,
    "totalAmountUsdcUnits": 12000000,
    "tutorBps": 8500,
    "platformBps": 1500
  },
  "blockchain": {
    "chainName": "Ethereum Sepolia Testnet",
    "chainId": 11155111,
    "escrowContract": "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3",
    "paymentTokenSymbol": "Mock USDC",
    "paymentTokenAddress": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    "paymentTokenDecimals": 6
  },
  "policy": {
    "paymentWindowSeconds": 86400,
    "disputeWindowSeconds": 86400,
    "disputeTypes": [
      "TUTOR_FRAUD",
      "QUALITY_COMPLAINT",
      "STUDENT_ABSENT_PROTEST"
    ]
  }
}
~~~

### ONLINE/OFFLINE validation

| learningMode | meetingPlatform | meetingLink | learningAddress |
| --- | --- | --- | --- |
| ONLINE | Bắt buộc | Bắt buộc, URL hợp lệ | null |
| OFFLINE | null | null | Bắt buộc, không rỗng |

### Canonical JSON

- UTF-8.
- Key sắp xếp ổn định.
- Timestamp UTC ISO-8601.
- Ví lowercase để so sánh; checksum riêng để hiển thị.
- Tiền là integer units.
- Sessions sắp startAt rồi sessionId.
- null/field vắng có một quy ước duy nhất.
- Không chứa field tạm của UI.

~~~text
canonicalBytes = UTF8(canonicalJson(snapshot))
termsHash = keccak256(canonicalBytes)
~~~

### Test bắt buộc

- Cùng snapshot cho cùng hash.
- Thứ tự key khác vẫn cùng hash sau canonicalize.
- Đổi học phí/link/địa chỉ làm đổi hash.
- Đảo sessions đầu vào vẫn cùng hash sau sort.
- Không freeze sai quyền/trạng thái.
- Snapshot đã freeze phải trả bản cũ.

### Prompt AI - Phase 2

~~~text
Triển khai Phase 2: snapshot bất biến và termsHash.

Tạo ContractTermsSnapshotV1 typed DTO/record, không dùng Map tự do làm domain chính.
Validate ONLINE cần meetingLink; OFFLINE cần learningAddress.
Canonicalize JSON ổn định; tiền dùng integer units; tính Keccak-256.
Lưu snapshot JSONB và termsHash trong cùng transaction.
Nếu đã freeze, trả snapshot cũ, không dựng lại từ dữ liệu live.
Thêm unit test determinism và thay đổi field.

Không triển khai Word/PDF. Chạy test rồi dừng.
~~~

---

## 9. PHASE 3 - WORD VÀ POI-TL

### Maven

Kiểm tra compatibility với Java/Spring/Apache POI hiện tại trước khi chốt version.

~~~xml
<dependency>
    <groupId>com.deepoove</groupId>
    <artifactId>poi-tl</artifactId>
    <version>1.12.2</version>
</dependency>
~~~

Template:

~~~text
src/main/resources/contract-templates/educonnect-contract-v1.docx
~~~

Classes:

~~~text
contract/
  application/ContractDocumentApplicationService
  domain/ContractTermsSnapshotV1
  domain/ContractTemplateModel
  infrastructure/docx/PoiTlContractRenderer
  infrastructure/docx/ContractTemplateDataMapper
  infrastructure/docx/ContractTemplateRegistry
~~~

~~~java
public interface ContractDocxRenderer {
    byte[] render(String templateKey, ContractTemplateModel model);
}
~~~

~~~java
public final class PoiTlContractRenderer implements ContractDocxRenderer {
    private final ResourceLoader resourceLoader;

    @Override
    public byte[] render(String templateKey, ContractTemplateModel model) {
        Resource resource = resourceLoader.getResource(
            "classpath:contract-templates/" + templateKey + ".docx"
        );
        try (
            InputStream input = resource.getInputStream();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            XWPFTemplate template = XWPFTemplate
                .compile(input)
                .render(model.toTemplateMap())
        ) {
            template.write(output);
            return output.toByteArray();
        } catch (Exception ex) {
            throw new ContractRenderException(templateKey, ex);
        }
    }
}
~~~

Điều chỉnh API close/write theo poi-tl version thực tế.

### Placeholder metadata

| Placeholder | Nguồn/quy tắc |
| --- | --- |
| contractNo | Snapshot |
| contractVersion | Snapshot/template registry |
| agreementUuid | Agreement |
| agreementKey | bytes32 đầy đủ |
| agreementKeyShort | Rút gọn, chỉ hiển thị |
| agreementStatus | Agreement |
| contractDate | dd/MM/yyyy |
| contractPlace | Config/snapshot |
| termsHash | Frozen document |
| termsHashShort | Rút gọn |
| paymentDeadline | Agreement |
| activatedAt | Agreement hoặc Không áp dụng |

### Placeholder gia sư

| Placeholder | Nguồn |
| --- | --- |
| tutorFullName | Tutor snapshot |
| tutorId | Tutor snapshot |
| tutorEmail | Tutor snapshot |
| tutorPhone | Tutor snapshot |
| tutorAddress | Tutor snapshot |
| tutorStatus | Tutor snapshot |
| tutorWallet | Tutor snapshot |
| tutorWalletShort | Derived |
| tutorSignature | ContractSignature |
| tutorSignatureShort | Derived |
| tutorSignedAt | ContractSignature |

### Placeholder học viên/người giám hộ

| Placeholder | Nguồn |
| --- | --- |
| studentFullName | Student snapshot |
| studentId | Student snapshot |
| studentEmail | Student snapshot |
| studentPhone | Student snapshot |
| studentDateOfBirth | Student snapshot |
| studentGrade | Student snapshot |
| studentAddress | Student snapshot |
| studentWallet | Student snapshot |
| studentWalletShort | Derived |
| studentSignature | ContractSignature |
| studentSignatureShort | Derived |
| studentSignedAt | ContractSignature |
| hasGuardian | age/policy |
| guardianFullName | Guardian snapshot |
| guardianRelationship | Guardian snapshot |
| guardianPhone | Guardian snapshot |
| guardianEmail | Guardian snapshot |

### Placeholder lớp học

| Placeholder | Nguồn/quy tắc |
| --- | --- |
| className | Classroom snapshot |
| classroomId | Classroom snapshot |
| totalSessions | Integer |
| durationPerSessionMinutes | Integer |
| learningMode | ONLINE/OFFLINE |
| meetingPlatform | ONLINE hoặc Không áp dụng |
| meetingLink | ONLINE hoặc Không áp dụng |
| learningAddress | OFFLINE hoặc Không áp dụng |
| courseStartDate | dd/MM/yyyy |
| courseEndDate | dd/MM/yyyy |

### Giá và blockchain

| Placeholder | Nguồn |
| --- | --- |
| vndPerUsdc | Pricing snapshot |
| pricePerSessionVnd | Pricing snapshot |
| pricePerSessionUsdc | Format từ units |
| totalAmountVnd | Pricing snapshot |
| totalAmountUsdc | Format từ units |
| paymentTokenSymbol | Chain config |
| paymentTokenAddress | Chain config |
| paymentTokenDecimals | Chain config |
| chainName | Chain config |
| chainId | Chain config |
| escrowContract | Chain config |
| platformOperatorName | Platform config |
| platformContactAddress | Platform config |
| platformSupportEmail | Platform config |
| platformWallet | Platform config |

### Bằng chứng

| Placeholder | Nguồn |
| --- | --- |
| eip712DomainName | Config |
| eip712DomainVersion | Config |
| fundingTxHash | Funding event |
| signatureBundleHash | Finalization service |
| verificationUrl | Verification URL |

### Loop lịch học

Template dùng alias ss. Mỗi item:

| Field | Nguồn |
| --- | --- |
| no | Số thứ tự |
| at | startAt đã format |
| min | Thời lượng |
| topic | Chapter/topic |
| location | meetingLink nếu ONLINE, learningAddress nếu OFFLINE |
| state | Session status |

### Display rules

- Field không áp dụng = “Không áp dụng”, không hiện null.
- Giá trị Short chỉ dùng phần tóm tắt.
- Phụ lục kỹ thuật dùng hash/ví/signature đầy đủ.
- meetingLink hiện URL đầy đủ; muốn click được thì dùng render policy hyperlink tương thích và test PDF.
- Không truyền entity JPA trực tiếp vào template.
- Không cho HTML tùy ý từ client.

### Kiểm tra placeholder

~~~bash
unzip -p generated-contract.docx word/document.xml | rg "\{\{|\}\}"
~~~

File phát hành không được còn kết quả từ lệnh trên.

### Prompt AI - Phase 3

~~~text
Triển khai Phase 3: render Word bằng poi-tl.

Trích xuất placeholder thật từ educonnect-contract-v1.docx và đối chiếu master plan.
Tạo typed ContractTemplateModel và mapper từ frozen snapshot.
ONLINE điền meetingPlatform/meetingLink, learningAddress = Không áp dụng.
OFFLINE điền learningAddress, meetingPlatform/meetingLink = Không áp dụng.
Loop sessions tạo location đúng mode.
Rút gọn wallet/hash chỉ cho field Short; phụ lục dùng đầy đủ.
Render classpath resource.
Test ONLINE, OFFLINE, có guardian, không guardian.
Test DOCX mở được và không còn placeholder.

Chưa chuyển PDF. Chạy test rồi dừng.
~~~

---

## 10. PHASE 4 - DOCX SANG PDF VÀ STORAGE

Khuyến nghị Gotenberg/LibreOffice. Không dùng html2canvas, html2pdf.js hoặc chụp DOM.

### Docker Compose

~~~yaml
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
    ports:
      - "3000:3000"
    command:
      - "gotenberg"
      - "--api-timeout=60s"
~~~

~~~bash
docker compose -f docker-compose.contract.yml up -d
docker compose -f docker-compose.contract.yml ps
~~~

Test:

~~~bash
curl --request POST --url http://localhost:3000/forms/libreoffice/convert --form files=@generated-contract.docx --output generated-contract.pdf
~~~

PowerShell:

~~~powershell
curl.exe --request POST --url http://localhost:3000/forms/libreoffice/convert --form "files=@generated-contract.docx" --output generated-contract.pdf
~~~

### Interfaces

~~~java
public interface DocumentConverter {
    byte[] docxToPdf(byte[] docxBytes, String filename);
}

public interface ContractArtifactStorage {
    StoredObject put(String objectKey, byte[] bytes, String contentType);
    InputStream get(String objectKey);
    boolean exists(String objectKey);
}
~~~

Object keys:

~~~text
contracts/<agreementUuid>/<contractVersion>/draft/contract.docx
contracts/<agreementUuid>/<contractVersion>/draft/contract.pdf
contracts/<agreementUuid>/<contractVersion>/final/contract.docx
contracts/<agreementUuid>/<contractVersion>/final/contract.pdf
~~~

Yêu cầu converter:

- Timeout/size limit.
- Retry giới hạn cho lỗi tạm thời.
- Validate content type và header %PDF.
- Không log PII/chữ ký/snapshot.
- Không trả object key thẳng cho frontend.

### Prompt AI - Phase 4

~~~text
Triển khai Phase 4: DOCX sang PDF và artifact storage.

Thêm Gotenberg phù hợp docker compose hiện tại.
Tạo DocumentConverter HTTP multipart và ContractArtifactStorage.
Có local adapter cho dev; tái dùng S3/MinIO adapter nếu project đã có.
Lưu draft DOCX/PDF bằng object key có version.
Không lưu binary trong PostgreSQL.
Chỉ ghi metadata sau storage thành công; xử lý cleanup khi DB thất bại.
Validate PDF header/content type và viết integration test.

Không làm frontend. Chạy test rồi dừng.
~~~

---

## 11. PHASE 5 - EIP-712

### Domain

~~~json
{
  "name": "EduConnectEscrow",
  "version": "1",
  "chainId": 11155111,
  "verifyingContract": "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3"
}
~~~

### Typed data đề xuất

Phải đối chiếu schema hiện có ở frontend/backend/Solidity trước khi đổi.

~~~json
{
  "primaryType": "ContractAcceptance",
  "types": {
    "ContractAcceptance": [
      { "name": "agreementId", "type": "bytes32" },
      { "name": "termsHash", "type": "bytes32" },
      { "name": "contractVersion", "type": "string" },
      { "name": "signer", "type": "address" },
      { "name": "role", "type": "uint8" },
      { "name": "nonce", "type": "uint256" },
      { "name": "deadline", "type": "uint256" }
    ]
  }
}
~~~

Role mapping gợi ý: TUTOR=1, STUDENT=2, GUARDIAN=3. Nếu code hiện tại khác thì giữ code hiện tại hoặc version schema.

### Backend bắt buộc kiểm tra

1. User đăng nhập.
2. Thuộc đúng Agreement.
3. Role được ký ở trạng thái hiện tại.
4. termsHash đúng snapshot.
5. chainId/verifyingContract đúng.
6. deadline chưa hết.
7. nonce chưa dùng.
8. signer bằng ví đăng ký.
9. recoveredAddress bằng signer.
10. Chưa có chữ ký hợp lệ cùng role/document.

Client chỉ gửi documentId/payloadId/signature. Backend tải signing payload đã cấp và tự xác minh; không tin termsHash/role/contract address tùy ý từ request.

### signatureBundleHash

Canonicalize và Keccak-256:

~~~json
{
  "termsHash": "0x...",
  "contractVersion": "1.0",
  "agreementKey": "0x...",
  "tutor": {
    "wallet": "0x...",
    "signature": "0x...",
    "signedAt": "..."
  },
  "student": {
    "wallet": "0x...",
    "signature": "0x...",
    "signedAt": "..."
  },
  "fundingTxHash": "0x..."
}
~~~

### Prompt AI - Phase 5

~~~text
Triển khai Phase 5: EIP-712 payload và signature verification.

Đối chiếu typed data hiện có ở frontend, backend và Solidity; không tự đổi schema đang được dùng.
Backend phát payload từ frozen snapshot, nonce duy nhất và deadline rõ ràng.
Kiểm tra user/Agreement/role/state, recover signer, chống replay.
Lưu typed_data, signature_hex, recovered_address, signed_at.
Không log signature đầy đủ.
Test đúng, sai ví, sai role, sai hash, hết hạn và nonce dùng lại.

Không finalize PDF. Chạy test rồi dừng.
~~~

---

## 12. PHASE 6 - FINALIZE

Trình tự:

1. Lock ContractDocument phù hợp.
2. Kiểm tra snapshot/đủ chữ ký/fundingTxHash.
3. Tính signatureBundleHash.
4. Dựng model từ snapshot và signature record.
5. Render final DOCX.
6. Convert final PDF.
7. Tính SHA-256 byte PDF cuối.
8. Lưu DOCX/PDF.
9. Ghi object keys, signatureBundleHash, finalPdfSha256.
10. Đặt FINALIZED.

Finalize phải idempotent: gọi lại trả artifact cũ, không tạo nội dung mới và không ghi đè snapshot.

Nếu render/convert/upload lỗi thì không được FINALIZED; lưu failure code an toàn và cho retry có kiểm soát.

### Prompt AI - Phase 6

~~~text
Triển khai Phase 6: finalize hợp đồng.

Finalize idempotent, chỉ dùng frozen snapshot/signature records.
Tính signatureBundleHash trước render.
Render final DOCX, convert PDF, tính finalPdfSha256 từ byte cuối và lưu ngoài PDF.
Lưu artifact versioned; chỉ FINALIZED khi mọi bước thành công.
Test finalize hai lần và lỗi converter/storage/retry.
Không sửa Smart Contract payout.

Chạy test rồi dừng.
~~~

---

## 13. PHASE 7 - REST API

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | /api/agreements/{id}/contract/freeze | Chốt snapshot |
| GET | /api/agreements/{id}/contract | Metadata/status |
| POST | /api/agreements/{id}/contract/draft | Tạo draft |
| GET | /api/agreements/{id}/contract/preview | Stream PDF |
| GET | /api/agreements/{id}/contract/download?format=pdf | Tải PDF |
| GET | /api/agreements/{id}/contract/download?format=docx | Tải DOCX |
| POST | /api/agreements/{id}/contract/signing-payload | Typed data |
| POST | /api/agreements/{id}/contract/signatures | Gửi chữ ký |
| POST | /api/agreements/{id}/contract/finalize | Bản cuối |
| GET | /api/contracts/verify/{verificationId} | Xác minh công khai giới hạn |

### Quyền

| Hành động | Tutor | Student/Guardian | Staff | Admin |
| --- | ---: | ---: | ---: | ---: |
| Xem hợp đồng của mình | Có | Có | Theo lớp | Mọi hợp đồng |
| Ký role của mình | Có | Có | Không | Không |
| Tải file | Có | Có | Theo lớp | Có |
| Xem dispute evidence | Theo phạm vi | Theo phạm vi | Theo lớp | Có |

Response metadata:

~~~json
{
  "agreementId": "...",
  "documentId": "...",
  "contractVersion": "1.0",
  "status": "PARTIALLY_SIGNED",
  "termsHash": "0x...",
  "requiredSigners": ["TUTOR", "STUDENT"],
  "signedRoles": ["TUTOR"],
  "previewAvailable": true,
  "downloadPdfAvailable": false
}
~~~

File response:

~~~text
Content-Type: application/pdf
Content-Disposition: inline; filename="hop-dong-<contractNo>.pdf"
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
~~~

### Prompt AI - Phase 7

~~~text
Triển khai Phase 7 REST API theo convention project.

Controller không chứa logic render/signature.
Kiểm tra quyền từng Agreement.
Stream qua backend hoặc URL ngắn hạn sau authorization.
Đặt Content-Type/Content-Disposition/no-store.
Không trả object key.
Validation/error code ổn định.
Viết test Tutor, Student, Staff, Admin và user ngoài Agreement.

Chạy test rồi dừng.
~~~

---

## 14. PHASE 8 - REACT PDF VIEWER VÀ KÝ

### Cài đặt

~~~bash
npm install react-pdf
~~~

Không dùng @react-pdf/renderer vì PDF đã được backend phát hành.

~~~tsx
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
~~~

Kiểm tra lại theo Vite/Webpack/Next của project.

### Cấu trúc

~~~text
features/contracts/
  api/contractApi.ts
  components/ContractViewer.tsx
  components/ContractToolbar.tsx
  components/ContractSignaturePanel.tsx
  components/ContractStatusBadge.tsx
  hooks/useContract.ts
  hooks/useContractPdf.ts
  hooks/useSignContract.ts
  pages/ContractDetailPage.tsx
~~~

Viewer:

~~~tsx
import { Document, Page } from "react-pdf";

export function ContractViewer({ pdfUrl }: { pdfUrl: string }) {
  const [pages, setPages] = useState(0);
  return (
    <Document
      file={{ url: pdfUrl, withCredentials: true }}
      onLoadSuccess={({ numPages }) => setPages(numPages)}
      loading={<ContractLoading />}
      error={<ContractLoadError />}
    >
      {Array.from({ length: pages }, (_, index) => (
        <Page
          key={index + 1}
          pageNumber={index + 1}
          renderTextLayer
          renderAnnotationLayer
        />
      ))}
    </Document>
  );
}
~~~

Nếu bearer token không dùng được trong URL, fetch Blob qua API client, tạo object URL và revoke khi unmount.

Ký bằng ethers:

~~~tsx
const signature = await signer.signTypedData(
  payload.domain,
  payload.types,
  payload.message
);

await contractApi.submitSignature(agreementId, {
  payloadId: payload.id,
  signature
});
~~~

Không tự dựng domain/message từ UI nếu backend cấp payload.

UI states:

- Loading metadata/PDF.
- Chờ freeze/gia sư ký/học viên ký/nạp quỹ.
- Đang finalize/đã hoàn tất/hết hạn.
- Sai network/sai ví/lỗi render.

ONLINE hiện nút mở meetingLink. OFFLINE hiện learningAddress. Không dùng studentAddress thay learningAddress nếu lớp có địa điểm riêng.

### Prompt AI - Phase 8

~~~text
Triển khai Phase 8 frontend React.

Đọc router, state/query library và API client hiện tại.
Dùng react-pdf hiển thị PDF backend; không tạo PDF ở frontend.
Preview/download phải cùng document/version.
Dùng signing payload backend; kiểm tra chainId/ví trước ký.
Xử lý đổi account/network giữa lúc mở modal và ký.
ONLINE hiện meetingLink; OFFLINE hiện learningAddress.
Có loading/error/expired/finalized states và responsive UI.
Thêm component test/E2E tối thiểu.

Chạy lint, test, build rồi dừng.
~~~

---

## 15. PHASE 9 - TEST END-TO-END

### Ma trận mode

| Case | Mode | Guardian | Kết quả |
| --- | --- | --- | --- |
| 1 | ONLINE | Không | PDF có meetingLink |
| 2 | ONLINE | Có | Có guardian |
| 3 | OFFLINE | Không | PDF có learningAddress |
| 4 | OFFLINE | Có | Có guardian và địa chỉ |
| 5 | ONLINE thiếu link | Bất kỳ | Freeze bị từ chối |
| 6 | OFFLINE thiếu địa chỉ | Bất kỳ | Freeze bị từ chối |

### Ma trận chữ ký

- Đúng ví Tutor/Student.
- Sai ví/role/chain/hash.
- Payload cũ, deadline hết hạn, nonce dùng lại.
- User ngoài Agreement.
- Đổi MetaMask account trước confirm.

### Ma trận tài liệu

- DOCX/PDF mở được, tiếng Việt đúng, không vỡ bảng.
- Không còn {{placeholder}}.
- Hash/ví dài không tràn.
- ONLINE/OFFLINE và guardian đúng.
- Loop sessions đúng số buổi.
- Preview/download cùng SHA-256.
- Finalize hai lần cùng artifact.

### Lệnh backend

~~~powershell
.\mvnw.cmd test
.\mvnw.cmd verify
~~~

Multi-module:

~~~bash
./mvnw -pl <agreement-service> -am test
~~~

Frontend:

~~~bash
npm run lint
npm run test
npm run build
~~~

File:

~~~bash
file generated-contract.docx
file generated-contract.pdf
unzip -t generated-contract.docx
pdftotext generated-contract.pdf - | rg "\{\{|\}\}"
sha256sum generated-contract.pdf
~~~

PowerShell:

~~~powershell
Get-FileHash generated-contract.pdf -Algorithm SHA256
~~~

### Prompt AI - Phase 9

~~~text
Thực hiện Phase 9 end-to-end, không thêm feature.

Chạy backend test, frontend lint/test/build.
Test ONLINE/OFFLINE, có/không guardian, EIP-712 đúng/sai.
Tạo DOCX/PDF thật; kiểm tra placeholder, hash preview/download và authorization.
Sửa tối thiểu lỗi phát hiện rồi chạy lại.

Kết thúc bằng bảng PASS/FAIL và lệnh đã chạy.
~~~

---

## 16. PHASE 10 - SECURITY VÀ RELEASE

Checklist:

- Authorization mọi file endpoint.
- Bucket không public; không trả object key.
- Không log PII/signature đầy đủ.
- Client không chọn arbitrary template path.
- Chống path traversal; sanitize filename.
- Size limit, timeout, rate limit.
- Audit ai freeze/ký/finalize/tải.
- Verification public không lộ email/phone/address.
- Replay protection.
- Migration backup/rollback.
- Template key/contractVersion cố định.
- Health check Gotenberg.
- Object retention/monitoring.
- Staging Sepolia PASS.
- Luật sư/business owner duyệt trước production thật.

### Prompt AI - Phase 10

~~~text
Thực hiện Phase 10 security/release audit.

Chỉ review và sửa lỗi release-blocking.
Kiểm tra authorization, PII/logging, storage visibility, path traversal,
replay EIP-712, transaction/idempotency, converter timeout/size,
migration rollback, config production, health/metrics/alerts.

Đưa bảng severity, file/symbol, cách tái hiện và trạng thái fix.
Chạy lại toàn bộ test.
~~~

---

## 17. BIẾN MÔI TRƯỜNG

~~~text
CONTRACT_TEMPLATE_KEY=educonnect-contract-v1
CONTRACT_VERSION=1.0
CONTRACT_GOTENBERG_URL=http://gotenberg:3000
CONTRACT_CONVERT_TIMEOUT_SECONDS=60
CONTRACT_MAX_DOCX_BYTES=10485760
CONTRACT_MAX_PDF_BYTES=20971520
CONTRACT_STORAGE_TYPE=local
CONTRACT_STORAGE_LOCAL_ROOT=./data/contracts
CONTRACT_VERIFICATION_BASE_URL=https://<host>/contracts/verify
EIP712_DOMAIN_NAME=EduConnectEscrow
EIP712_DOMAIN_VERSION=1
EIP712_CHAIN_ID=11155111
EIP712_VERIFYING_CONTRACT=0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3
~~~

Không commit secret, access key hoặc private key.

---

## 18. ERROR CODE

| Code | Ý nghĩa |
| --- | --- |
| CONTRACT_NOT_FOUND | Không có tài liệu |
| CONTRACT_FORBIDDEN | Không có quyền |
| CONTRACT_INVALID_STATE | Sai trạng thái |
| CONTRACT_TERMS_ALREADY_FROZEN | Snapshot đã chốt |
| CONTRACT_TEMPLATE_NOT_FOUND | Thiếu template |
| CONTRACT_TEMPLATE_DATA_INVALID | Thiếu dữ liệu |
| CONTRACT_RENDER_FAILED | Lỗi DOCX |
| CONTRACT_CONVERSION_FAILED | Lỗi PDF |
| CONTRACT_STORAGE_FAILED | Lỗi lưu |
| CONTRACT_SIGNATURE_INVALID | Chữ ký sai |
| CONTRACT_SIGNER_MISMATCH | Không khớp ví |
| CONTRACT_SIGNATURE_EXPIRED | Hết hạn |
| CONTRACT_NONCE_REUSED | Replay |
| CONTRACT_FINALIZATION_FAILED | Finalize lỗi |

Không trả stack trace nội bộ ra frontend.

---

## 19. THỨ TỰ COMMIT

~~~text
feat(contract): add document persistence model
feat(contract): freeze canonical contract terms
feat(contract): render DOCX from versioned template
feat(contract): convert and store PDF artifacts
feat(contract): verify EIP-712 contract signatures
feat(contract): finalize immutable contract document
feat(contract): expose secured contract APIs
feat(web): add contract PDF viewer and signing flow
test(contract): add end-to-end contract scenarios
docs(contract): document deployment and operations
~~~

Mỗi commit phải build/test được.

---

## 20. MASTER PROMPT KHỞI ĐỘNG AI

~~~text
Bạn là kỹ sư chính triển khai hợp đồng Word/PDF cho EduConnect.

Nguồn bắt buộc:
- docs/contracts/EDUCONNECT_CONTRACT_IMPLEMENTATION_MASTER_PLAN.md
- docs/contracts/thong_tin.md
- contract-templates/educonnect-contract-v1.docx
- Code Agreement, classroom, schedules, attendance, payment, dispute,
  EIP-712, Solidity và frontend liên quan

Nguyên tắc:
1. Không đoán field/table/class/endpoint; phải tìm trong code.
2. Không sửa payout/dispute/Solidity ngoài phase.
3. Không phá thay đổi đang có.
4. Snapshot freeze là bất biến.
5. PDF chính thức sinh ở backend.
6. ONLINE dùng meetingLink; OFFLINE dùng learningAddress.
7. Không dùng float/double cho tiền.
8. Không tin termsHash/role/contract address do client tự gửi.
9. Mỗi phase phải có test và báo cáo lệnh.
10. Chỉ làm phase được chỉ định rồi dừng.

Trước khi sửa:
- Đọc AGENTS.md/instruction của repo.
- Chạy git status.
- Liệt kê file dự kiến sửa.
- Nêu assumption/blocker.

Sau khi sửa:
- Liệt kê file thay đổi.
- Tóm tắt quyết định.
- Chạy test/lint/build.
- Báo PASS/FAIL.
- Nêu phase kế nhưng không tự làm.

Bắt đầu PHASE 0 - AUDIT, tuyệt đối chưa sửa code.
~~~

---

## 21. PROMPT KHI AI ĐI QUÁ PHẠM VI

~~~text
Dừng triển khai feature mới.

Đối chiếu thay đổi hiện tại với phase trong master plan.
Giữ thay đổi hợp lệ; không reset/xóa thay đổi người dùng.
Liệt kê phần vượt phạm vi, thu hẹp lại đúng phase và chạy test bị tác động.
Báo cáo diff còn lại và lý do.
~~~

---

## 22. DEFINITION OF DONE

- [ ] Phase 0 audit được duyệt.
- [ ] Migration PASS.
- [ ] Snapshot/termsHash deterministic.
- [ ] ONLINE/OFFLINE validation.
- [ ] Word không còn placeholder.
- [ ] Gotenberg ổn định.
- [ ] Artifact ngoài PostgreSQL.
- [ ] EIP-712 recover đúng signer/chống replay.
- [ ] Finalize idempotent.
- [ ] finalPdfSha256 lưu ngoài PDF.
- [ ] React hiển thị PDF backend.
- [ ] Preview/download cùng artifact.
- [ ] Authorization Tutor/Student/Staff/Admin.
- [ ] Dispute/payout không bị ảnh hưởng.
- [ ] Backend test PASS.
- [ ] Frontend lint/test/build PASS.
- [ ] Staging Sepolia PASS.
- [ ] Monitoring/rollback plan.
- [ ] Nội dung được duyệt trước production thật.

---

## 23. VIỆC ĐẦU TIÊN LÀM NGAY

1. Tải Word và master plan.
2. Chép vào repository theo mục 5.2.
3. Tạo nhánh feature.
4. Mở AI/Codex ở root repository.
5. Gửi nguyên Prompt Phase 0.
6. Chỉ khi báo cáo Phase 0 đúng code thật mới cho chạy Phase 1.

Không bắt đầu bằng React, MetaMask hay PDF converter. Điểm bắt đầu đúng là audit service sở hữu Agreement và chốt mô hình snapshot/hash.
