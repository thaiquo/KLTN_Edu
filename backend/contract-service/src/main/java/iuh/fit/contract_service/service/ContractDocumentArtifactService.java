package iuh.fit.contract_service.service;

import iuh.fit.contract_service.api.dto.ContractDocumentViewDto;
import iuh.fit.contract_service.config.ContractDocumentProperties;
import iuh.fit.contract_service.document.ContractArtifactStorage;
import iuh.fit.contract_service.document.ContractDocxRenderer;
import iuh.fit.contract_service.document.DocumentConverter;
import iuh.fit.contract_service.entity.ContractDocumentArtifact;
import iuh.fit.contract_service.enums.ContractDocumentArtifactStatus;
import iuh.fit.contract_service.repository.ContractDocumentArtifactRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Hash;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ContractDocumentArtifactService {
    private static final Set<String> FINALIZABLE_STATUSES = Set.of(
            "WAITING_PAYMENT", "PAYMENT_CONFIRMING", "ACTIVE", "COMPLETED");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ContractDocumentQueryService queryService;
    private final ContractDocumentArtifactRepository artifactRepository;
    private final EscrowPaymentRepository paymentRepository;
    private final ContractDocxRenderer renderer;
    private final DocumentConverter converter;
    private final ContractArtifactStorage storage;
    private final ContractDocumentProperties properties;

    public ContractDocumentArtifactService(
            ContractDocumentQueryService queryService,
            ContractDocumentArtifactRepository artifactRepository,
            EscrowPaymentRepository paymentRepository,
            ContractDocxRenderer renderer,
            DocumentConverter converter,
            ContractArtifactStorage storage,
            ContractDocumentProperties properties) {
        this.queryService = queryService;
        this.artifactRepository = artifactRepository;
        this.paymentRepository = paymentRepository;
        this.renderer = renderer;
        this.converter = converter;
        this.storage = storage;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public Optional<ContractDocumentArtifact> find(UUID agreementId) {
        return queryService.findDocumentView(agreementId).flatMap(view ->
                artifactRepository.findByAgreementIdAndContractVersion(agreementId, view.contractVersion()));
    }

    @Transactional
    public synchronized ContractDocumentArtifact finalizeDocument(UUID agreementId) {
        ContractDocumentViewDto view = queryService.findDocumentView(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Hợp đồng không tồn tại"));
        validateFinalizable(view);
        validateLearningTerms(view);

        ContractDocumentArtifact artifact = artifactRepository
                .findByAgreementIdAndContractVersion(agreementId, view.contractVersion())
                .orElseGet(() -> newArtifact(view));
        if (artifact.getStatus() == ContractDocumentArtifactStatus.READY) return artifact;

        artifact.setStatus(ContractDocumentArtifactStatus.GENERATING);
        artifact.setFailureCode(null);
        artifact.setFailureMessage(null);
        artifact.setUpdatedAt(OffsetDateTime.now());
        artifactRepository.saveAndFlush(artifact);

        String baseKey = "contracts/" + agreementId + "/v" + view.contractVersion() + "/final/contract";
        String docxKey = baseKey + ".docx";
        String pdfKey = baseKey + ".pdf";
        boolean docxStored = false;
        try {
            byte[] docx = renderer.render(toTemplateModel(view));
            byte[] pdf = converter.docxToPdf(docx, "contract-" + agreementId + ".docx");
            storage.put(docxKey, docx,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            docxStored = true;
            storage.put(pdfKey, pdf, MediaTypes.PDF);

            artifact.setDocxObjectKey(docxKey);
            artifact.setPdfObjectKey(pdfKey);
            artifact.setDocxSha256(sha256(docx));
            artifact.setPdfSha256(sha256(pdf));
            artifact.setDocxSize((long) docx.length);
            artifact.setPdfSize((long) pdf.length);
            artifact.setGeneratedAt(OffsetDateTime.now());
            artifact.setStatus(ContractDocumentArtifactStatus.READY);
        } catch (RuntimeException ex) {
            if (docxStored) {
                try { storage.delete(docxKey); } catch (RuntimeException ignored) {}
            }
            artifact.setStatus(ContractDocumentArtifactStatus.FAILED);
            artifact.setFailureCode("CONTRACT_DOCUMENT_GENERATION_FAILED");
            artifact.setFailureMessage(truncate(rootMessage(ex), 1000));
        }
        artifact.setUpdatedAt(OffsetDateTime.now());
        return artifactRepository.save(artifact);
    }

    @Transactional(readOnly = true)
    public byte[] read(UUID agreementId, String format) {
        ContractDocumentArtifact artifact = find(agreementId)
                .orElseThrow(() -> new IllegalStateException("Hợp đồng chưa có artifact"));
        if (artifact.getStatus() != ContractDocumentArtifactStatus.READY) {
            throw new IllegalStateException("Artifact hợp đồng chưa sẵn sàng");
        }
        return storage.get("docx".equalsIgnoreCase(format)
                ? artifact.getDocxObjectKey() : artifact.getPdfObjectKey());
    }

    private ContractDocumentArtifact newArtifact(ContractDocumentViewDto view) {
        OffsetDateTime now = OffsetDateTime.now();
        return ContractDocumentArtifact.builder()
                .id(UUID.randomUUID()).agreementId(UUID.fromString(view.agreementId()))
                .contractVersion(view.contractVersion()).templateVersion(properties.templateVersion())
                .status(ContractDocumentArtifactStatus.GENERATING)
                .createdAt(now).updatedAt(now).build();
    }

    private void validateFinalizable(ContractDocumentViewDto view) {
        if (!FINALIZABLE_STATUSES.contains(view.status())) {
            throw new IllegalStateException("Chỉ sinh file cuối sau khi cả hai bên đã ký");
        }
        if (!view.tutorSignature().signed() || !hasText(view.tutorSignature().signature())
                || !view.studentSignature().signed() || !hasText(view.studentSignature().signature())) {
            throw new IllegalStateException("Hợp đồng chưa đủ hai chữ ký EIP-712");
        }
        if (!hasText(view.className()) || !complete(view.tutor()) || !complete(view.student())) {
            throw new IllegalStateException("Snapshot hợp đồng thiếu tên lớp hoặc danh tính thật của hai bên");
        }
    }

    private void validateLearningTerms(ContractDocumentViewDto view) {
        if (view.termsJson() == null || view.termsJson().isBlank()
                || !view.termsHash().equalsIgnoreCase(Hash.sha3String(view.termsJson()))) {
            throw new IllegalStateException("Terms Hash does not match the immutable agreement snapshot");
        }
        ContractDocumentViewDto.LearningTermsDto learning = view.learningTerms();
        if (learning == null || !hasText(learning.learningMode()) || !hasText(learning.courseStartDate())
                || !hasText(learning.courseEndDate()) || learning.durationPerSessionMinutes() == null
                || learning.durationPerSessionMinutes() <= 0 || learning.schedules() == null || learning.schedules().isEmpty()
                || ("ONLINE".equalsIgnoreCase(learning.learningMode()) && !hasText(learning.meetingLink()))
                || ("OFFLINE".equalsIgnoreCase(learning.learningMode()) && !hasText(learning.learningAddress()))) {
            throw new IllegalStateException("Signed snapshot is missing required classroom terms");
        }
    }

    private boolean complete(ContractDocumentViewDto.PartyDto party) {
        return hasText(party.fullName()) && hasText(party.email()) && hasText(party.phone())
                && hasText(party.walletAddress());
    }

    private Map<String, Object> toTemplateModel(ContractDocumentViewDto view) {
        Map<String, Object> m = new HashMap<>();
        String missing = "Chưa cập nhật";
        String privateId = "Đã xác thực nội bộ (không công khai ID)";
        String agreementKey = value(view.onchainAgreementId(), missing);
        String tutorSignature = value(view.tutorSignature().signature(), missing);
        String studentSignature = value(view.studentSignature().signature(), missing);
        String bundleHash = Hash.sha3String(view.termsHash() + "|" + tutorSignature + "|" + studentSignature);
        String fundingTx = paymentRepository.findByAgreementId(UUID.fromString(view.agreementId()))
                .map(payment -> value(payment.getFundTxHash(), "Chưa phát sinh"))
                .orElse("Chưa phát sinh");

        m.put("contractNo", "EDU-" + view.createdAt().getYear() + "-" + view.agreementId().substring(0, 8).toUpperCase(Locale.ROOT));
        m.put("contractVersion", view.contractVersion());
        m.put("agreementUuid", view.agreementId());
        m.put("contractDate", date(view.createdAt()));
        m.put("agreementKey", agreementKey);
        m.put("agreementKeyShort", shortValue(agreementKey));
        m.put("termsHash", view.termsHash());
        m.put("termsHashShort", shortValue(view.termsHash()));
        m.put("chainName", chainName(view.platform().chainId()));
        m.put("chainId", value(view.platform().chainId(), missing));
        m.put("contractPlace", properties.platformContactAddress());

        putParty(m, "tutor", view.tutor(), view.tutorSignature(), privateId, missing);
        putParty(m, "student", view.student(), view.studentSignature(), privateId, missing);
        m.put("tutorStatus", "Tài khoản EduConnect đã xác thực");
        m.put("tutorAddress", missing);
        m.put("studentDateOfBirth", missing);
        m.put("studentGrade", missing);
        m.put("studentAddress", missing);
        m.put("hasGuardian", false);
        m.put("guardianFullName", missing);
        m.put("guardianRelationship", missing);
        m.put("guardianPhone", missing);
        m.put("guardianEmail", missing);

        m.put("platformOperatorName", properties.platformOperatorName());
        m.put("platformContactAddress", properties.platformContactAddress());
        m.put("platformSupportEmail", properties.platformSupportEmail());
        m.put("platformWallet", value(view.platform().walletAddress(), missing));
        m.put("escrowContract", value(view.platform().escrowContractAddress(), missing));

        m.put("className", view.className());
        m.put("classroomId", privateId);
        m.put("totalSessions", view.financialTerms().totalSessions());
        ContractDocumentViewDto.LearningTermsDto learning = view.learningTerms();
        m.put("durationPerSessionMinutes", learning.durationPerSessionMinutes());
        m.put("learningMode", learning.learningMode());
        m.put("meetingPlatform", value(learning.meetingPlatform(), missing));
        m.put("meetingLink", value(learning.meetingLink(), missing));
        m.put("learningAddress", value(learning.learningAddress(), missing));
        m.put("courseStartDate", learning.courseStartDate());
        m.put("courseEndDate", learning.courseEndDate());
        m.put("ss", learning.schedules().stream().map(schedule -> Map.of(
                "no", String.valueOf(schedule.dayOfWeek()),
                "topic", "Buổi học định kỳ",
                "at", vietnameseDay(schedule.dayOfWeek()) + " " + schedule.startTime() + " - " + schedule.endTime(),
                "min", String.valueOf(learning.durationPerSessionMinutes()),
                "location", "ONLINE".equalsIgnoreCase(learning.learningMode()) ? learning.meetingLink() : learning.learningAddress(),
                "state", learning.learningMode())).toList());

        m.put("vndPerUsdc", number(view.financialTerms().vndPerUsdc()));
        m.put("pricePerSessionVnd", number(view.financialTerms().pricePerSessionVnd()));
        m.put("pricePerSessionUsdc", number(view.financialTerms().pricePerSessionUsdc()));
        m.put("totalAmountVnd", number(view.financialTerms().totalPriceVnd()));
        m.put("totalAmountUsdc", number(view.financialTerms().totalAmountUsdc()));
        m.put("paymentTokenSymbol", view.financialTerms().tokenSymbol());
        m.put("paymentTokenAddress", value(view.platform().tokenAddress(), missing));
        m.put("paymentTokenDecimals", view.financialTerms().tokenDecimals());
        m.put("paymentDeadline", dateTime(view.paymentDeadline()));
        m.put("agreementStatus", view.status());
        m.put("fundingTxHash", fundingTx);
        m.put("activatedAt", "Không áp dụng tại thời điểm ký");
        m.put("signatureBundleHash", bundleHash);
        m.put("eip712DomainName", "EduConnectEscrow");
        m.put("eip712DomainVersion", String.valueOf(view.contractVersion()));
        m.put("verificationUrl", properties.verificationBaseUrl() + "/" + view.agreementId());
        return m;
    }

    private void putParty(Map<String, Object> model, String prefix,
                          ContractDocumentViewDto.PartyDto party,
                          ContractDocumentViewDto.SignatureProofDto proof,
                          String privateId, String missing) {
        model.put(prefix + "FullName", value(party.fullName(), missing));
        model.put(prefix + "Id", privateId);
        model.put(prefix + "Email", value(party.email(), missing));
        model.put(prefix + "Phone", value(party.phone(), missing));
        model.put(prefix + "Wallet", value(party.walletAddress(), missing));
        model.put(prefix + "WalletShort", shortValue(value(party.walletAddress(), missing)));
        model.put(prefix + "Signature", value(proof.signature(), missing));
        model.put(prefix + "SignatureShort", shortValue(value(proof.signature(), missing)));
        model.put(prefix + "SignedAt", dateTime(proof.acceptedAt()));
    }

    private String date(OffsetDateTime value) {
        return value == null ? "Chưa cập nhật" : DATE.format(value.atZoneSameInstant(VIETNAM));
    }

    private String dateTime(OffsetDateTime value) {
        return value == null ? "Chưa cập nhật" : DATE_TIME.format(value.atZoneSameInstant(VIETNAM));
    }

    private String chainName(Long chainId) {
        return Objects.equals(chainId, 11155111L) ? "Ethereum Sepolia Testnet" : "Mạng EVM";
    }

    private String vietnameseDay(Integer dayOfWeek) {
        return switch (dayOfWeek == null ? 0 : dayOfWeek) {
            case 2 -> "Thứ Hai";
            case 3 -> "Thứ Ba";
            case 4 -> "Thứ Tư";
            case 5 -> "Thứ Năm";
            case 6 -> "Thứ Sáu";
            case 7 -> "Thứ Bảy";
            case 8 -> "Chủ Nhật";
            default -> "Ngày học";
        };
    }

    private String number(String value) {
        if (!hasText(value)) return "Chưa cập nhật";
        return new BigDecimal(value).stripTrailingZeros().toPlainString();
    }

    private String shortValue(String value) {
        if (!hasText(value) || value.length() <= 24) return value;
        return value.substring(0, 12) + "..." + value.substring(value.length() - 8);
    }

    private String value(Object value, String fallback) {
        return value == null || !hasText(String.valueOf(value)) ? fallback : String.valueOf(value);
    }

    private boolean hasText(String value) { return value != null && !value.isBlank(); }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tính SHA-256", ex);
        }
    }

    private String rootMessage(Throwable ex) {
        Throwable current = ex;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage() != null ? current.getMessage() : current.getClass().getSimpleName();
    }

    private String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static final class MediaTypes {
        private static final String PDF = "application/pdf";
    }
}
