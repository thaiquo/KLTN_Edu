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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    private final AgreementRegistrationWorkflowService registrationWorkflowService;

    public ContractSignatureService(
            ContractAgreementRepository agreementRepository,
            ContractAcceptanceRepository acceptanceRepository,
            NotificationDispatcher notificationDispatcher,
            Eip712VerificationService verificationService,
            AgreementRegistrationWorkflowService registrationWorkflowService) {
        this.agreementRepository = agreementRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.notificationDispatcher = notificationDispatcher;
        this.verificationService = verificationService;
        this.registrationWorkflowService = registrationWorkflowService;
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

        if (signature == null || signature.isBlank()) {
            throw new IllegalArgumentException("Missing EIP-712 signature from wallet.");
        }
        String expectedWallet = "STUDENT".equals(normalizedRole) ? agreement.getStudentWallet()
                : "TUTOR".equals(normalizedRole) ? agreement.getTutorWallet() : null;
        if (expectedWallet == null || !normalizedWallet.equalsIgnoreCase(expectedWallet)
                || expectedWallet.equalsIgnoreCase("0x" + "0".repeat(40)) || agreement.isLegacyExcluded()) {
            throw new IllegalArgumentException("Signing wallet must match the immutable agreement party wallet");
        }
        if (ContractTermsSnapshotService.SCHEMA_VERSION.equals(snapshotVersion(agreement))
                && !new ContractTermsSnapshotService().matchesHash(agreement.getTermsJson(), agreement.getTermsHash())) {
            throw new IllegalStateException("Agreement terms hash does not match its immutable snapshot");
        }

        long createdAtSeconds = agreement.getCreatedAt() != null ? agreement.getCreatedAt().toEpochSecond() : 0L;
        long chainId = agreement.getChainId() != null ? agreement.getChainId() : 11155111L;
        String escrowContract = agreement.getEscrowContractAddress() != null
                ? agreement.getEscrowContractAddress()
                : "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3";
        if ("STUDENT".equals(normalizedRole)
                && ContractTermsSnapshotService.SCHEMA_VERSION.equals(snapshotVersion(agreement))
                && !normalizedWallet.equalsIgnoreCase(agreement.getStudentWallet())) {
            throw new IllegalArgumentException("Ví ký của học viên không khớp ví đã được snapshot trong điều khoản hợp đồng.");
        }
        String signedStudentWallet = agreement.getStudentWallet();

        boolean valid = verificationService.verifySignature(
                normalizedWallet,
                signature,
                agreement.getId().toString(),
                agreement.getTutorWallet(),
                signedStudentWallet,
                agreement.getTotalAmountUsdcUnits(),
                agreement.getTermsHash(),
                createdAtSeconds,
                chainId,
                escrowContract
        );

        if (!valid) {
            throw new IllegalArgumentException("Invalid EIP-712 signature for the signing wallet and agreement terms.");
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

            // Record student acceptance with signature
            recordAcceptance(agreement, userId, "STUDENT", normalizedWallet, signature, ipAddress, userAgent, now);

            boolean hasTutorAcceptance = acceptanceRepository.findByAgreementId(agreementId).stream()
                    .anyMatch(a -> "TUTOR".equalsIgnoreCase(a.getRole()));
            if (!hasTutorAcceptance) {
                throw new IllegalStateException("Hợp đồng chưa có chữ ký xác nhận của Gia sư.");
            }

            // WAITING_PAYMENT is opened only after the on-chain AgreementRegistered event is confirmed.
            agreement.transitionTo(ContractAgreementStatus.PREPARING_BLOCKCHAIN);
            agreement.setUpdatedAt(now);
            ContractAgreement saved = agreementRepository.saveAndFlush(agreement);
            initiateRegistrationAfterCommit(saved.getId());

            log.info("Student {} signed agreement {}. Status updated to PREPARING_BLOCKCHAIN; registration intent will be initiated",
                    userId, agreementId);

            return saved;
        } else {
            throw new IllegalArgumentException("Vai trò không hợp lệ để ký hợp đồng: " + role);
        }
    }

    private String extractStudentEmail(ContractAgreement agreement) {
        return agreement.getStudentEmail();
    }

    private String snapshotVersion(ContractAgreement agreement) {
        String terms = agreement.getTermsJson();
        return terms != null && terms.contains("\"schemaVersion\":\"contract-terms-v2\"")
                ? ContractTermsSnapshotService.SCHEMA_VERSION : null;
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

    private void initiateRegistrationAfterCommit(UUID agreementId) {
        Runnable command = () -> {
            try {
                registrationWorkflowService.initiateRegistration(agreementId);
            } catch (Exception exception) {
                log.error("Could not initiate on-chain registration for agreement {}", agreementId, exception);
            }
        };

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            command.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                java.util.concurrent.CompletableFuture.runAsync(command);
            }
        });
    }
}
