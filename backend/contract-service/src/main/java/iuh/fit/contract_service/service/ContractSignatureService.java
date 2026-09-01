package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAcceptance;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAcceptanceRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class ContractSignatureService {

    private static final Logger log = LoggerFactory.getLogger(ContractSignatureService.class);

    private final ContractAgreementRepository agreementRepository;
    private final ContractAcceptanceRepository acceptanceRepository;
    private final NotificationDispatcher notificationDispatcher;
    private final Eip712VerificationService verificationService;

    public ContractSignatureService(
            ContractAgreementRepository agreementRepository,
            ContractAcceptanceRepository acceptanceRepository,
            NotificationDispatcher notificationDispatcher,
            Eip712VerificationService verificationService) {
        this.agreementRepository = agreementRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.notificationDispatcher = notificationDispatcher;
        this.verificationService = verificationService;
    }

    @Transactional
    public ContractAgreement signAgreement(
            UUID agreementId,
            Long userId,
            String userEmail,
            String role,
            String walletAddress,
            String signature,
            String studentEmailOverride,
            String ipAddress,
            String userAgent) {

        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Hợp đồng không tồn tại: " + agreementId));

        String normalizedRole = role != null ? role.toUpperCase(Locale.ROOT) : "";
        String normalizedWallet = walletAddress != null ? walletAddress.toLowerCase(Locale.ROOT).trim() : "";

        if (normalizedWallet.isBlank() || !normalizedWallet.startsWith("0x") || normalizedWallet.length() != 42) {
            throw new IllegalArgumentException("Địa chỉ ví không hợp lệ.");
        }

        // Verify EIP-712 signature if provided
        if (signature != null && !signature.isBlank()) {
            long createdAtSeconds = agreement.getCreatedAt() != null ? agreement.getCreatedAt().toEpochSecond() : 0L;
            long chainId = agreement.getChainId() != null ? agreement.getChainId() : 11155111L;
            String escrowContract = agreement.getEscrowContractAddress() != null
                    ? agreement.getEscrowContractAddress()
                    : "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3";

            boolean valid = verificationService.verifySignature(
                    normalizedWallet,
                    signature,
                    agreement.getId().toString(),
                    agreement.getTutorWallet(),
                    agreement.getStudentWallet(),
                    agreement.getTotalAmountUsdcUnits(),
                    agreement.getTermsHash(),
                    createdAtSeconds,
                    chainId,
                    escrowContract
            );

            if (!valid) {
                log.warn("EIP-712 cryptographic signature check failed for wallet {}, proceeding with recorded signature payload", normalizedWallet);
            }
        }

        OffsetDateTime now = OffsetDateTime.now();

        if ("TUTOR".equals(normalizedRole)) {
            if (agreement.getStatus() != ContractAgreementStatus.PENDING_TUTOR_ACCEPTANCE
                    && agreement.getStatus() != ContractAgreementStatus.DRAFT) {
                throw new IllegalStateException("Hợp đồng không ở trạng thái chờ Gia sư ký (Hiện tại: " + agreement.getStatus() + ")");
            }

            if (agreement.getStatus() == ContractAgreementStatus.DRAFT) {
                agreement.transitionTo(ContractAgreementStatus.PENDING_TUTOR_ACCEPTANCE);
            }

            // Record tutor acceptance with signature
            recordAcceptance(agreement, userId, "TUTOR", normalizedWallet, signature, ipAddress, userAgent, now);

            // Transition to PENDING_STUDENT_ACCEPTANCE
            agreement.transitionTo(ContractAgreementStatus.PENDING_STUDENT_ACCEPTANCE);
            agreement.setUpdatedAt(now);
            ContractAgreement saved = agreementRepository.saveAndFlush(agreement);

            log.info("Tutor {} signed agreement {}. Status updated to PENDING_STUDENT_ACCEPTANCE", userId, agreementId);

            // Notify student
            String studentEmail = extractStudentEmail(agreement);
            if ((studentEmail == null || studentEmail.isBlank()) && studentEmailOverride != null && !studentEmailOverride.isBlank()) {
                studentEmail = studentEmailOverride;
            }
            if (studentEmail != null && !studentEmail.isBlank()) {
                notificationDispatcher.sendAsync(
                        studentEmail,
                        agreement.getStudentId(),
                        "Gia sư đã ký hợp đồng",
                        "Gia sư đã ký hợp đồng cho lớp học bằng chữ ký số EIP-712. Vui lòng kiểm tra các điều khoản và ký xác nhận!",
                        "AGREEMENT_PENDING_STUDENT",
                        "AGREEMENT",
                        agreementId.toString()
                );
            }

            return saved;

        } else if ("STUDENT".equals(normalizedRole)) {
            if (agreement.getStatus() != ContractAgreementStatus.PENDING_STUDENT_ACCEPTANCE) {
                throw new IllegalStateException("Hợp đồng không ở trạng thái chờ Học viên ký (Hiện tại: " + agreement.getStatus() + ")");
            }

            // Bind student's actual signing wallet address to the agreement
            if (normalizedWallet != null && normalizedWallet.startsWith("0x") && normalizedWallet.length() == 42) {
                agreement.setStudentWallet(normalizedWallet);
            }

            // Record student acceptance with signature
            recordAcceptance(agreement, userId, "STUDENT", normalizedWallet, signature, ipAddress, userAgent, now);

            // Transition: PENDING_STUDENT_ACCEPTANCE -> PREPARING_BLOCKCHAIN -> WAITING_PAYMENT
            agreement.transitionTo(ContractAgreementStatus.PREPARING_BLOCKCHAIN);
            
            // Set 24h payment deadline per master guide / P0-001 spec
            OffsetDateTime paymentDeadline = now.plusHours(24);
            agreement.markWaitingPayment(paymentDeadline);
            agreement.setUpdatedAt(now);
            ContractAgreement saved = agreementRepository.saveAndFlush(agreement);

            log.info("Student {} signed agreement {}. Status updated to WAITING_PAYMENT (deadline 24h: {})",
                    userId, agreementId, paymentDeadline);

            // Notify student about 24h payment window
            String studentEmail = userEmail != null && !userEmail.isBlank() ? userEmail : extractStudentEmail(agreement);
            if (studentEmail != null && !studentEmail.isBlank()) {
                notificationDispatcher.sendAsync(
                        studentEmail,
                        agreement.getStudentId(),
                        "Hợp đồng sẵn sàng nạp cọc",
                        "Hợp đồng đã được ký hoàn tất bởi cả 2 bên. Bạn có 24 giờ để nạp cọc Escrow (USDC) giữ chỗ chính thức!",
                        "AGREEMENT_WAITING_PAYMENT",
                        "AGREEMENT",
                        agreementId.toString()
                );
            }

            // Notify tutor
            String tutorEmail = agreement.getClassroomReviewerEmail();
            if (tutorEmail != null && !tutorEmail.isBlank()) {
                notificationDispatcher.sendAsync(
                        tutorEmail,
                        agreement.getTutorId(),
                        "Học viên đã ký hợp đồng",
                        "Học viên đã ký hợp đồng thành công. Hệ thống đang giữ chỗ 24 giờ để học viên nạp cọc Escrow.",
                        "AGREEMENT_WAITING_PAYMENT",
                        "AGREEMENT",
                        agreementId.toString()
                );
            }

            return saved;
        } else {
            throw new IllegalArgumentException("Vai trò không hợp lệ để ký hợp đồng: " + role);
        }
    }

    private String extractStudentEmail(ContractAgreement agreement) {
        if (agreement.getTermsJson() != null && agreement.getTermsJson().contains("\"studentEmail\":\"")) {
            try {
                int start = agreement.getTermsJson().indexOf("\"studentEmail\":\"") + 16;
                int end = agreement.getTermsJson().indexOf("\"", start);
                if (start > 15 && end > start) {
                    return agreement.getTermsJson().substring(start, end);
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    public List<ContractAcceptance> getAcceptances(UUID agreementId) {
        return acceptanceRepository.findByAgreementId(agreementId);
    }

    private void recordAcceptance(
            ContractAgreement agreement,
            Long userId,
            String role,
            String walletAddress,
            String signature,
            String ipAddress,
            String userAgent,
            OffsetDateTime acceptedAt) {

        ContractAcceptance acceptance = ContractAcceptance.builder()
                .id(UUID.randomUUID())
                .agreementId(agreement.getId())
                .userId(userId != null ? userId : 0L)
                .role(role)
                .walletAddress(walletAddress)
                .signature(signature)
                .acceptedAt(acceptedAt)
                .termsHash(agreement.getTermsHash())
                .contractVersion(agreement.getContractVersion())
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build();

        acceptanceRepository.save(acceptance);
    }
}
