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

    public AgreementFundingWorkflowService(
            ContractAgreementRepository agreementRepository,
            EscrowPaymentRepository escrowPaymentRepository,
            OutboxEventRepository outboxEventRepository,
            ContractDocumentArtifactService artifactService,
            ObjectMapper objectMapper,
            LearningServiceDispatcher learningServiceDispatcher,
            NotificationDispatcher notificationDispatcher) {
        this.agreementRepository = agreementRepository;
        this.escrowPaymentRepository = escrowPaymentRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.artifactService = artifactService;
        this.objectMapper = objectMapper;
        this.learningServiceDispatcher = learningServiceDispatcher;
        this.notificationDispatcher = notificationDispatcher;
    }

    @Transactional
    public void recordPaymentSubmission(UUID agreementId, String fundTxHash) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));

        if (fundTxHash == null || !fundTxHash.matches("^0x[a-fA-F0-9]{64}$")) {
            throw new IllegalArgumentException("Invalid funded transaction hash.");
        }

        if (agreement.getStatus() == ContractAgreementStatus.WAITING_PAYMENT) {
            agreement.markPaymentConfirming();
            agreementRepository.saveAndFlush(agreement);
        } else if (agreement.getStatus() != ContractAgreementStatus.PAYMENT_CONFIRMING) {
            throw new IllegalStateException("Agreement must be in WAITING_PAYMENT or PAYMENT_CONFIRMING before funding can be recorded, actual: " + agreement.getStatus());
        }

        EscrowPayment payment = escrowPaymentRepository.findByAgreementId(agreementId)
                .orElseGet(() -> EscrowPayment.create(agreement));

        payment.recordConfirming(fundTxHash);
        escrowPaymentRepository.saveAndFlush(payment);

        log.info("Recorded payment submission for agreement {} with txHash {}", agreementId, fundTxHash);
    }

    @Transactional
    public void recordDirectFundingActivation(UUID agreementId, String fundTxHash) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));

        if (fundTxHash == null || !fundTxHash.matches("^0x[a-fA-F0-9]{64}$")) {
            throw new IllegalArgumentException("Invalid funded transaction hash.");
        }

        if (agreement.getStatus() != ContractAgreementStatus.WAITING_PAYMENT
                && agreement.getStatus() != ContractAgreementStatus.PAYMENT_CONFIRMING) {
            throw new IllegalStateException("Agreement must be in WAITING_PAYMENT or PAYMENT_CONFIRMING before funding can be activated, actual: " + agreement.getStatus());
        }

        agreement.markActive();
        agreement.setUpdatedAt(OffsetDateTime.now());
        agreementRepository.saveAndFlush(agreement);

        EscrowPayment payment = escrowPaymentRepository.findByAgreementId(agreementId)
                .orElseGet(() -> EscrowPayment.create(agreement));

        payment.markLocked(fundTxHash, 0L, "0x_confirmed_tx");
        escrowPaymentRepository.saveAndFlush(payment);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String payloadJson = String.format(
                "{\"agreementId\":\"%s\",\"classroomId\":%d,\"studentId\":%d,\"tutorId\":%d,\"onchainAgreementId\":\"%s\",\"totalAmountUsdcUnits\":\"%s\",\"fundTxHash\":\"%s\",\"activatedAt\":\"%s\"}",
                agreement.getId(),
                agreement.getClassroomId(),
                agreement.getStudentId(),
                agreement.getTutorId(),
                agreement.getOnchainAgreementId(),
                agreement.getTotalAmountUsdcUnits(),
                fundTxHash,
                now);

        OutboxEvent outboxEvent = OutboxEvent.create(
                "contract.activated.v1",
                "ContractAgreement",
                agreement.getId().toString(),
                null,
                payloadJson,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        scheduleOfficialDocumentFinalization(agreement.getId());

        // Dispatch activation to learning-service to grant student classroom access
        learningServiceDispatcher.activateEnrollmentAsync(
                agreement.getClassroomId(), agreement.getStudentId(), agreement.getId().toString());

        // Notifications
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

        String tutorEmail = agreement.getClassroomReviewerEmail();
        if (tutorEmail != null && !tutorEmail.isBlank()) {
            notificationDispatcher.sendAsync(
                    tutorEmail,
                    agreement.getTutorId(),
                    "Học viên đã nạp cọc Escrow",
                    "Học viên đã nạp cọc thành công vào Smart Contract Escrow. Hợp đồng lớp học đã chính thức HOẠT ĐỘNG (ACTIVE)!",
                    "AGREEMENT_ACTIVATED",
                    "AGREEMENT",
                    agreement.getId().toString()
            );
        }

        log.info("Directly activated agreement {} with txHash {}", agreementId, fundTxHash);
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

        agreement.markActive();
        agreementRepository.saveAndFlush(agreement);

        EscrowPayment payment = escrowPaymentRepository.findByAgreementId(agreement.getId())
                .orElseGet(() -> EscrowPayment.create(agreement));

        payment.markLocked(event.getTransactionHash(), event.getBlockNumber(), event.getBlockHash());
        escrowPaymentRepository.saveAndFlush(payment);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String payloadJson = String.format(
                "{\"agreementId\":\"%s\",\"classroomId\":%d,\"studentId\":%d,\"tutorId\":%d,\"onchainAgreementId\":\"%s\",\"totalAmountUsdcUnits\":\"%s\",\"fundTxHash\":\"%s\",\"blockNumber\":%d,\"activatedAt\":\"%s\"}",
                agreement.getId(),
                agreement.getClassroomId(),
                agreement.getStudentId(),
                agreement.getTutorId(),
                agreement.getOnchainAgreementId(),
                agreement.getTotalAmountUsdcUnits(),
                event.getTransactionHash(),
                event.getBlockNumber(),
                now);

        OutboxEvent outboxEvent = OutboxEvent.create(
                "contract.activated.v1",
                "ContractAgreement",
                agreement.getId().toString(),
                null,
                payloadJson,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        scheduleOfficialDocumentFinalization(agreement.getId());

        // Dispatch activation to learning-service
        learningServiceDispatcher.activateEnrollmentAsync(
                agreement.getClassroomId(), agreement.getStudentId(), agreement.getId().toString());

        log.info("Successfully transitioned agreement {} to ACTIVE and payment to LOCKED from event tx {}",
                agreement.getId(), event.getTransactionHash());
        return true;
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

    private void validateEventAttributesMatchAgreement(ContractAgreement agreement, Map<String, String> attrs) {
        requireAttributeMatch("student", agreement.getStudentWallet(), attrs.get("student"));
        requireAttributeMatch("amount", agreement.getTotalAmountUsdcUnits().toString(), attrs.get("amount"));
    }

    private void requireAttributeMatch(String fieldName, String expected, String actual) {
        if (actual == null || !expected.equalsIgnoreCase(actual)) {
            throw new IllegalStateException(String.format(
                    "Event attribute mismatch for field '%s': expected '%s', got '%s'", fieldName, expected, actual));
        }
    }
}
