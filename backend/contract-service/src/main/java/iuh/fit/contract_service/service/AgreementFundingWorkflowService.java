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
    private final ObjectMapper objectMapper;

    public AgreementFundingWorkflowService(
            ContractAgreementRepository agreementRepository,
            EscrowPaymentRepository escrowPaymentRepository,
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper) {
        this.agreementRepository = agreementRepository;
        this.escrowPaymentRepository = escrowPaymentRepository;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void recordPaymentSubmission(UUID agreementId, String fundTxHash) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));

        if (agreement.getStatus() == ContractAgreementStatus.WAITING_PAYMENT) {
            agreement.markPaymentConfirming();
            agreementRepository.saveAndFlush(agreement);
        }

        EscrowPayment payment = escrowPaymentRepository.findByAgreementId(agreementId)
                .orElseGet(() -> EscrowPayment.create(agreement));

        payment.recordConfirming(fundTxHash);
        escrowPaymentRepository.saveAndFlush(payment);

        log.info("Recorded payment submission for agreement {} with txHash {}", agreementId, fundTxHash);
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

        log.info("Successfully transitioned agreement {} to ACTIVE and payment to LOCKED from event tx {}",
                agreement.getId(), event.getTransactionHash());
        return true;
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
