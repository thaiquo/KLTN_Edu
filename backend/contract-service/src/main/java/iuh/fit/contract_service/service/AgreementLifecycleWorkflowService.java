package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EduConnectEscrowCalldataEncoder;
import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AgreementLifecycleWorkflowService {
    private static final Logger log = LoggerFactory.getLogger(AgreementLifecycleWorkflowService.class);
    private static final List<SettlementStatus> OPEN_SETTLEMENT_STATUSES = List.of(
            SettlementStatus.PROPOSE_PENDING,
            SettlementStatus.PROPOSED,
            SettlementStatus.DISPUTE_OPENING,
            SettlementStatus.DISPUTED,
            SettlementStatus.FINALIZE_PENDING);

    private final ContractAgreementRepository agreementRepository;
    private final SessionSettlementRepository settlementRepository;
    private final BlockchainTransactionCommandService commandService;
    private final OutboxEventRepository outboxEventRepository;
    private final LearningServiceDispatcher learningServiceDispatcher;
    private final NotificationDispatcher notificationDispatcher;
    private final ObjectMapper objectMapper;

    public AgreementLifecycleWorkflowService(
            ContractAgreementRepository agreementRepository,
            SessionSettlementRepository settlementRepository,
            BlockchainTransactionCommandService commandService,
            OutboxEventRepository outboxEventRepository,
            LearningServiceDispatcher learningServiceDispatcher,
            NotificationDispatcher notificationDispatcher,
            ObjectMapper objectMapper) {
        this.agreementRepository = agreementRepository;
        this.settlementRepository = settlementRepository;
        this.commandService = commandService;
        this.outboxEventRepository = outboxEventRepository;
        this.learningServiceDispatcher = learningServiceDispatcher;
        this.notificationDispatcher = notificationDispatcher;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateExpiration(UUID agreementId) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));
        if (agreement.getStatus() != ContractAgreementStatus.WAITING_PAYMENT) {
            throw new IllegalStateException("Only WAITING_PAYMENT agreements can expire on-chain, actual: " + agreement.getStatus());
        }
        if (agreement.getPaymentDeadline() == null
                || OffsetDateTime.now(ZoneOffset.UTC).isBefore(agreement.getPaymentDeadline())) {
            throw new IllegalStateException("Payment deadline has not passed");
        }

        String calldata = EduConnectEscrowCalldataEncoder.encodeExpireAgreement(agreement.getOnchainAgreementId());
        String idempotencyKey = "EXPIRE:" + agreement.getChainId() + ":" + agreement.getId();
        return commandService.createIntent(command(agreement, null, idempotencyKey,
                BlockchainTransactionAction.EXPIRE, calldata));
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateCancellation(UUID agreementId, String reason) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));
        if (agreement.getStatus() != ContractAgreementStatus.ACTIVE) {
            throw new IllegalStateException("Only ACTIVE funded agreements can be cancelled with unused refund, actual: " + agreement.getStatus());
        }
        if (settlementRepository.existsByAgreementIdAndStatusIn(agreement.getId(), OPEN_SETTLEMENT_STATUSES)) {
            throw new IllegalStateException("Cannot cancel while a session settlement or dispute is still open");
        }

        String reasonHash = toBytes32Hash("CANCEL:" + agreement.getId() + ":" + (reason != null ? reason : ""));
        String calldata = EduConnectEscrowCalldataEncoder.encodeCancelAgreementAndRefundUnused(
                agreement.getOnchainAgreementId(), reasonHash);
        String idempotencyKey = "CANCEL:" + agreement.getChainId() + ":" + agreement.getId();
        return commandService.createIntent(command(agreement, null, idempotencyKey,
                BlockchainTransactionAction.CANCEL, calldata));
    }

    @Transactional
    public boolean processCompletedEvent(ProcessedEvent event) {
        if (!"AGREEMENT_COMPLETED".equalsIgnoreCase(event.getEventType())) {
            return false;
        }
        ContractAgreement agreement = findAgreement(event, decode(event)).orElse(null);
        if (agreement == null) {
            return false;
        }
        if (agreement.getStatus() == ContractAgreementStatus.COMPLETED) {
            return true;
        }
        agreement.markCompleted();
        agreementRepository.saveAndFlush(agreement);
        saveOutbox("contract.completed.v1", agreement, "");
        log.info("Agreement {} completed from confirmed AgreementCompleted event", agreement.getId());
        return true;
    }

    @Transactional
    public boolean processExpiredEvent(ProcessedEvent event) {
        if (!"AGREEMENT_EXPIRED".equalsIgnoreCase(event.getEventType())) {
            return false;
        }
        ContractAgreement agreement = findAgreement(event, decode(event)).orElse(null);
        if (agreement == null) {
            return false;
        }
        if (agreement.getStatus() == ContractAgreementStatus.EXPIRED) {
            return true;
        }
        agreement.markExpired();
        agreementRepository.saveAndFlush(agreement);
        learningServiceDispatcher.expireEnrollmentAsync(
                agreement.getClassroomId(), agreement.getStudentId(), agreement.getId().toString());
        notifyAgreementParties(agreement, "AGREEMENT_EXPIRED", "Contract payment expired",
                "The escrow payment window expired and the reserved seat was released.");
        saveOutbox("contract.expired.v1", agreement, "");
        log.info("Agreement {} expired from confirmed AgreementExpired event", agreement.getId());
        return true;
    }

    @Transactional
    public boolean processCancelledEvent(ProcessedEvent event) {
        if (!"AGREEMENT_CANCELLED".equalsIgnoreCase(event.getEventType())) {
            return false;
        }
        DecodedEscrowEvent decoded = decode(event);
        ContractAgreement agreement = findAgreement(event, decoded).orElse(null);
        if (agreement == null) {
            return false;
        }
        if (agreement.getStatus() == ContractAgreementStatus.CANCELLED) {
            return true;
        }
        agreement.markCancelled();
        agreementRepository.saveAndFlush(agreement);
        learningServiceDispatcher.expireEnrollmentAsync(
                agreement.getClassroomId(), agreement.getStudentId(), agreement.getId().toString());
        notifyAgreementParties(agreement, "AGREEMENT_CANCELLED", "Contract cancelled",
                "The funded contract was cancelled and unused escrow is being refunded.");
        saveOutbox("contract.cancelled.v1", agreement,
                "\"reasonHash\":\"" + safe(decoded.attributes().get("reasonHash")) + "\"");
        log.info("Agreement {} cancelled from confirmed AgreementCancelled event", agreement.getId());
        return true;
    }

    @Transactional
    public boolean processUnusedAmountRefundedEvent(ProcessedEvent event) {
        if (!"UNUSED_AMOUNT_REFUNDED".equalsIgnoreCase(event.getEventType())) {
            return false;
        }
        DecodedEscrowEvent decoded = decode(event);
        ContractAgreement agreement = findAgreement(event, decoded).orElse(null);
        if (agreement == null) {
            return false;
        }
        Map<String, String> attrs = decoded.attributes();
        saveOutbox("contract.unused_refunded.v1", agreement,
                "\"student\":\"" + safe(attrs.get("student")) + "\",\"amount\":\"" + safe(attrs.get("amount")) + "\"");
        log.info("Recorded unused escrow refund for agreement {} from tx {}", agreement.getId(), event.getTransactionHash());
        return true;
    }

    private BlockchainTransactionCommand command(
            ContractAgreement agreement,
            UUID settlementId,
            String idempotencyKey,
            BlockchainTransactionAction action,
            String calldata) {
        return new BlockchainTransactionCommand(
                idempotencyKey,
                action,
                agreement.getChainId(),
                agreement.getPlatformWallet(),
                agreement.getEscrowContractAddress(),
                calldata,
                Hash.sha3(calldata),
                agreement.getId(),
                settlementId,
                null);
    }

    private java.util.Optional<ContractAgreement> findAgreement(ProcessedEvent event, DecodedEscrowEvent decoded) {
        return agreementRepository.findByChainIdAndOnchainAgreementId(
                event.getChainId(), decoded.agreementId().toLowerCase(Locale.ROOT));
    }

    private DecodedEscrowEvent decode(ProcessedEvent event) {
        try {
            return objectMapper.readValue(event.getDecodedPayload(), DecodedEscrowEvent.class);
        } catch (Exception e) {
            throw new IllegalStateException("Invalid event payload", e);
        }
    }

    private void saveOutbox(String eventType, ContractAgreement agreement, String extraFields) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String payloadJson = String.format(
                "{\"agreementId\":\"%s\",\"classroomId\":%d,\"studentId\":%d,\"tutorId\":%d,\"status\":\"%s\",\"occurredAt\":\"%s\"%s%s}",
                agreement.getId(),
                agreement.getClassroomId(),
                agreement.getStudentId(),
                agreement.getTutorId(),
                agreement.getStatus(),
                now,
                extraFields == null || extraFields.isBlank() ? "" : ",",
                extraFields == null ? "" : extraFields);
        outboxEventRepository.saveAndFlush(OutboxEvent.create(
                eventType,
                "ContractAgreement",
                agreement.getId().toString(),
                null,
                payloadJson,
                now));
    }

    private void notifyAgreementParties(ContractAgreement agreement, String type, String title, String content) {
        notificationDispatcher.sendAsync(
                agreement.getStudentEmail(), agreement.getStudentId(), title, content,
                type, "AGREEMENT", agreement.getId().toString());
        notificationDispatcher.sendAsync(
                agreement.getTutorEmail(), agreement.getTutorId(), title, content,
                type, "AGREEMENT", agreement.getId().toString());
    }

    private static String toBytes32Hash(String value) {
        return Hash.sha3String(value == null ? "" : value);
    }

    private static String safe(String raw) {
        return raw == null ? "" : raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
