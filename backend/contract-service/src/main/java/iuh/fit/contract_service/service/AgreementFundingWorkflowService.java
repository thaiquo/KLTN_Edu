package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AgreementFundingWorkflowService {
    private static final Logger log = LoggerFactory.getLogger(AgreementFundingWorkflowService.class);

    private final ContractAgreementRepository agreementRepository;
    private final EscrowPaymentRepository escrowPaymentRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final ContractDocumentArtifactService artifactService;
    private final ObjectMapper objectMapper;
    private final LearningServiceDispatcher learningServiceDispatcher;
    private final NotificationDispatcher notificationDispatcher;
    private final iuh.fit.contract_service.repository.AgreementTrialRepository agreementTrialRepository;
    private final TerminationService terminationService;

    public AgreementFundingWorkflowService(
            ContractAgreementRepository agreementRepository,
            EscrowPaymentRepository escrowPaymentRepository,
            OutboxEventRepository outboxEventRepository,
            ContractDocumentArtifactService artifactService,
            ObjectMapper objectMapper,
            LearningServiceDispatcher learningServiceDispatcher,
            NotificationDispatcher notificationDispatcher) {
        this(agreementRepository, escrowPaymentRepository, outboxEventRepository, artifactService, objectMapper,
                learningServiceDispatcher, notificationDispatcher, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AgreementFundingWorkflowService(
            ContractAgreementRepository agreementRepository,
            EscrowPaymentRepository escrowPaymentRepository,
            OutboxEventRepository outboxEventRepository,
            ContractDocumentArtifactService artifactService,
            ObjectMapper objectMapper,
            LearningServiceDispatcher learningServiceDispatcher,
            NotificationDispatcher notificationDispatcher,
            iuh.fit.contract_service.repository.AgreementTrialRepository agreementTrialRepository,
            TerminationService terminationService) {
        this.agreementRepository = agreementRepository;
        this.escrowPaymentRepository = escrowPaymentRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.artifactService = artifactService;
        this.objectMapper = objectMapper;
        this.learningServiceDispatcher = learningServiceDispatcher;
        this.notificationDispatcher = notificationDispatcher;
        this.agreementTrialRepository = agreementTrialRepository;
        this.terminationService = terminationService;
    }

    @Transactional
    public ContractAgreement recordPaymentSubmission(UUID agreementId, String fundTxHash) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));

        if (fundTxHash == null || !fundTxHash.matches("^0x[a-fA-F0-9]{64}$")) {
            throw new IllegalArgumentException("Invalid funded transaction hash.");
        }

        EscrowPayment existingPayment = escrowPaymentRepository.findByAgreementId(agreementId).orElse(null);
        if (agreement.getStatus() == ContractAgreementStatus.ACTIVE
                || agreement.getStatus() == ContractAgreementStatus.COMPLETED) {
            if (existingPayment != null
                    && existingPayment.getFundTxHash() != null
                    && existingPayment.getFundTxHash().equalsIgnoreCase(fundTxHash)) {
                log.info("Funding event was confirmed before payment submission for agreement {}; accepting matching txHash idempotently",
                        agreementId);
                return agreement;
            }
            throw new IllegalStateException("Agreement is already funded by a different transaction.");
        }

        if (agreement.getPaymentDeadline() != null
                && OffsetDateTime.now(ZoneOffset.UTC).isAfter(agreement.getPaymentDeadline())) {
            throw new IllegalStateException("Payment deadline has passed.");
        }

        EscrowPayment payment = existingPayment != null ? existingPayment : EscrowPayment.create(agreement);

        if (agreement.getStatus() == ContractAgreementStatus.WAITING_PAYMENT) {
            agreement.markPaymentConfirming();
            agreementRepository.saveAndFlush(agreement);
        } else if (agreement.getStatus() == ContractAgreementStatus.PAYMENT_CONFIRMING) {
            if (payment.getFundTxHash() != null && payment.getFundTxHash().equalsIgnoreCase(fundTxHash)) {
                log.info("Ignoring duplicate payment submission for agreement {} with txHash {}", agreementId, fundTxHash);
                return agreement;
            }
            throw new IllegalStateException("Agreement already has a funding transaction pending confirmation.");
        } else {
            throw new IllegalStateException("Agreement must be in WAITING_PAYMENT or PAYMENT_CONFIRMING before funding can be recorded, actual: " + agreement.getStatus());
        }

        payment.recordConfirming(fundTxHash);
        escrowPaymentRepository.saveAndFlush(payment);

        log.info("Recorded payment submission for agreement {} with txHash {}", agreementId, fundTxHash);
        return agreement;
    }

    @Transactional
    public void recordDirectFundingActivation(UUID agreementId, String fundTxHash) {
        throw new UnsupportedOperationException("Direct funding activation is not supported; wait for confirmed AgreementFunded event.");
    }

    @Transactional
    public boolean processConfirmedFundingEvent(ProcessedEvent event) {
        if (!"AGREEMENT_FUNDED".equalsIgnoreCase(event.getEventType())) {
            return false;
        }

        DecodedEscrowEvent decodedEvent;
        try {
            decodedEvent = objectMapper.readValue(event.getDecodedPayload(), DecodedEscrowEvent.class);
        } catch (Exception e) {
            log.error("Failed to deserialize ProcessedEvent decodedPayload for event ID {}", event.getId(), e);
            throw new IllegalStateException("Invalid event payload", e);
        }

        String onchainAgreementId = decodedEvent.agreementId().toLowerCase(Locale.ROOT);
        ContractAgreement agreement = agreementRepository
                .findByChainIdAndOnchainAgreementId(event.getChainId(), onchainAgreementId)
                .orElse(null);

        if (agreement == null) {
            log.warn("No agreement found for chainId {} and onchainAgreementId {}", event.getChainId(), onchainAgreementId);
            return false;
        }

        if (agreement.getStatus() == ContractAgreementStatus.ACTIVE
                || agreement.getStatus() == ContractAgreementStatus.COMPLETED) {
            log.info("Agreement {} is already in {} status", agreement.getId(), agreement.getStatus());
            return true;
        }

        if (agreement.getStatus() != ContractAgreementStatus.WAITING_PAYMENT
                && agreement.getStatus() != ContractAgreementStatus.PAYMENT_CONFIRMING) {
            throw new IllegalStateException("Cannot transition agreement " + agreement.getId() +
                    " to ACTIVE from current status " + agreement.getStatus());
        }

        Map<String, String> attrs = decodedEvent.attributes();
        validateEventAttributesMatchAgreement(agreement, attrs);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        boolean lateFundingForTrial = agreementTrialRepository != null
                && agreementTrialRepository.findByAgreementId(agreement.getId())
                .map(trial -> !now.isBefore(trial.getTrialSessionStartAt()))
                .orElse(false);

        agreement.markActive();
        agreementRepository.saveAndFlush(agreement);

        EscrowPayment payment = escrowPaymentRepository.findByAgreementId(agreement.getId())
                .orElseGet(() -> EscrowPayment.create(agreement));

        payment.markLocked(event.getTransactionHash(), event.getBlockNumber(), event.getBlockHash());
        escrowPaymentRepository.saveAndFlush(payment);

        String payloadJson = String.format(
                "{\"agreementId\":\"%s\",\"classroomId\":%d,\"studentId\":%d,\"tutorId\":%d,\"onchainAgreementId\":\"%s\",\"totalAmountUsdcUnits\":\"%s\",\"fundTxHash\":\"%s\",\"blockNumber\":%d,\"activatedAt\":\"%s\",\"lateTrialFunding\":%s}",
                agreement.getId(),
                agreement.getClassroomId(),
                agreement.getStudentId(),
                agreement.getTutorId(),
                agreement.getOnchainAgreementId(),
                agreement.getTotalAmountUsdcUnits(),
                event.getTransactionHash(),
                event.getBlockNumber(),
                now,
                lateFundingForTrial);

        OutboxEvent outboxEvent = OutboxEvent.create(
                lateFundingForTrial ? "contract.trial_late_funding.v1" : "contract.activated.v1",
                "ContractAgreement",
                agreement.getId().toString(),
                null,
                payloadJson,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        scheduleOfficialDocumentFinalization(agreement.getId());

        if (!lateFundingForTrial) {
            scheduleLearningEnrollmentActivation(agreement);
            sendActivationNotifications(agreement);
        } else {
            if (terminationService == null) {
                throw new IllegalStateException("Late trial funding recovery service is unavailable");
            }
            UUID recoveryCaseId = terminationService.queueLateTrialFundingRecovery(agreement.getId(), now);
            log.error("Late trial funding incident for agreement {}: funds are locked but normal enrollment activation is blocked",
                    agreement.getId());
            sendLateFundingIncidentNotifications(agreement);
            log.warn("Queued idempotent late funding termination case {} for agreement {}",
                    recoveryCaseId, agreement.getId());
        }

        log.info("Transitioned agreement {} to ACTIVE and payment to LOCKED from event tx {} (lateTrialFunding={})",
                agreement.getId(), event.getTransactionHash(), lateFundingForTrial);
        return true;
    }

    private void sendLateFundingIncidentNotifications(ContractAgreement agreement) {
        String message = "Giao dịch ký quỹ được xác nhận sau thời điểm bắt đầu buổi trải nghiệm. "
                + "Hệ thống đã chặn kích hoạt lớp và đang giữ hồ sơ để đối soát, hủy và hoàn tiền an toàn; "
                + "không có buổi học nào được tạo ngược thời gian.";
        notificationDispatcher.sendAsync(
                agreement.getStudentEmail(), agreement.getStudentId(),
                "Ký quỹ cần được đối soát", message,
                "TRIAL_LATE_FUNDING_INCIDENT", "AGREEMENT", agreement.getId().toString());
        notificationDispatcher.sendAsync(
                agreement.getClassroomReviewerEmail(), null,
                "Cảnh báo ký quỹ trial xác nhận trễ", message,
                "TRIAL_LATE_FUNDING_INCIDENT", "AGREEMENT", agreement.getId().toString());
    }

    private void scheduleOfficialDocumentFinalization(UUID agreementId) {
        Runnable finalizeTask = () -> {
            try {
                artifactService.finalizeDocument(agreementId);
            } catch (RuntimeException ex) {
                log.warn("Agreement {} activated but official document artifact was not generated: {}",
                        agreementId, ex.getMessage());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    finalizeTask.run();
                }
            });
        } else {
            finalizeTask.run();
        }
    }

    private void scheduleLearningEnrollmentActivation(ContractAgreement agreement) {
        Long classroomId = agreement.getClassroomId();
        Long studentId = agreement.getStudentId();
        String agreementId = agreement.getId().toString();
        Runnable activationTask = () -> learningServiceDispatcher.activateEnrollmentAsync(classroomId, studentId, agreementId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    activationTask.run();
                }
            });
        } else {
            activationTask.run();
        }
    }

    private void validateEventAttributesMatchAgreement(ContractAgreement agreement, Map<String, String> attrs) {
        requireAttributeMatch("student", agreement.getStudentWallet(), attrs.get("student"));
        requireAttributeMatch("amount", agreement.getTotalAmountUsdcUnits().toString(), attrs.get("amount"));
    }

    private void sendActivationNotifications(ContractAgreement agreement) {
        String studentEmail = agreement.getStudentEmail();
        if (studentEmail != null && !studentEmail.isBlank()) {
            notificationDispatcher.sendAsync(
                    studentEmail,
                    agreement.getStudentId(),
                    "Nạp cọc Escrow thành công",
                    "Bạn đã nạp cọc thành công vào Smart Contract Escrow. Hợp đồng chính thức kích hoạt và bạn đã được thêm vào lớp học!",
                    "AGREEMENT_ACTIVATED",
                    "AGREEMENT",
                    agreement.getId().toString()
            );
        }

        String tutorEmail = agreement.getTutorEmail();
        if ((tutorEmail == null || tutorEmail.isBlank()) && agreement.getClassroomReviewerEmail() != null) {
            tutorEmail = agreement.getClassroomReviewerEmail();
        }
        if (tutorEmail != null && !tutorEmail.isBlank()) {
            notificationDispatcher.sendAsync(
                    tutorEmail,
                    agreement.getTutorId(),
                    "Học viên đã nạp cọc Escrow",
                    "Học viên đã nạp cọc thành công vào Smart Contract Escrow. Hợp đồng lớp học đã chính thức hoạt động.",
                    "AGREEMENT_ACTIVATED",
                    "AGREEMENT",
                    agreement.getId().toString()
            );
        }
    }

    private void requireAttributeMatch(String fieldName, String expected, String actual) {
        if (actual == null || !expected.equalsIgnoreCase(actual)) {
            throw new IllegalStateException(String.format(
                    "Event attribute mismatch for field '%s': expected '%s', got '%s'", fieldName, expected, actual));
        }
    }
}
