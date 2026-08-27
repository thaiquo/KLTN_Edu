package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EduConnectEscrowCalldataEncoder;
import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
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

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class SessionSettlementWorkflowService {
    private static final Logger log = LoggerFactory.getLogger(SessionSettlementWorkflowService.class);

    private final ContractAgreementRepository agreementRepository;
    private final SessionSettlementRepository sessionSettlementRepository;
    private final BlockchainTransactionCommandService commandService;
    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public SessionSettlementWorkflowService(
            ContractAgreementRepository agreementRepository,
            SessionSettlementRepository sessionSettlementRepository,
            BlockchainTransactionCommandService commandService,
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper) {
        this.agreementRepository = agreementRepository;
        this.sessionSettlementRepository = sessionSettlementRepository;
        this.commandService = commandService;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateSessionProposal(
            UUID agreementId, Long sessionId, SettlementOutcome outcome, String evidenceHash) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));

        if (agreement.getStatus() != ContractAgreementStatus.ACTIVE) {
            throw new IllegalStateException("Agreement must be in ACTIVE status to propose session, actual: " + agreement.getStatus());
        }

        String onchainSessionId = computeOnchainSessionId(sessionId);
        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndSessionId(agreementId, sessionId)
                .orElseGet(() -> SessionSettlement.create(
                        agreement,
                        sessionId,
                        onchainSessionId,
                        outcome,
                        agreement.getPricePerSessionUsdcUnits(),
                        evidenceHash));

        settlement.markProposePending();
        sessionSettlementRepository.saveAndFlush(settlement);

        String calldata = EduConnectEscrowCalldataEncoder.encodeProposeSessionSettlement(
                agreement.getOnchainAgreementId(),
                onchainSessionId,
                outcome.ordinal(),
                evidenceHash);

        String calldataHash = Hash.sha3(calldata);
        String idempotencyKey = "PROPOSE:" + agreement.getChainId() + ":" + agreementId + ":" + sessionId;

        BlockchainTransactionCommand command = new BlockchainTransactionCommand(
                idempotencyKey,
                BlockchainTransactionAction.PROPOSE,
                agreement.getChainId(),
                agreement.getPlatformWallet(),
                agreement.getEscrowContractAddress(),
                calldata,
                calldataHash,
                agreementId,
                settlement.getId(),
                null);

        return commandService.createIntent(command);
    }

    @Transactional
    public boolean processConfirmedSessionProposalEvent(ProcessedEvent event) {
        if (!"SESSION_SETTLEMENT_PROPOSED".equalsIgnoreCase(event.getEventType())) {
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
        String onchainSessionId = decodedEvent.sessionId().toLowerCase(Locale.ROOT);

        ContractAgreement agreement = agreementRepository
                .findByChainIdAndOnchainAgreementId(event.getChainId(), onchainAgreementId)
                .orElse(null);

        if (agreement == null) {
            log.warn("No agreement found for chainId {} and onchainAgreementId {}", event.getChainId(), onchainAgreementId);
            return false;
        }

        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndOnchainSessionId(agreement.getId(), onchainSessionId)
                .orElse(null);

        if (settlement == null) {
            log.warn("No session settlement found for agreement {} and onchainSessionId {}",
                    agreement.getId(), onchainSessionId);
            return false;
        }

        if (settlement.getStatus() == SettlementStatus.PROPOSED
                || settlement.getStatus() == SettlementStatus.SETTLED
                || settlement.getStatus() == SettlementStatus.REFUNDED) {
            log.info("Session settlement {} is already in {} status", settlement.getId(), settlement.getStatus());
            return true;
        }

        Map<String, String> attrs = decodedEvent.attributes();
        long deadlineSeconds = Long.parseLong(attrs.get("disputeDeadline"));
        OffsetDateTime disputeDeadline = OffsetDateTime.ofInstant(Instant.ofEpochSecond(deadlineSeconds), ZoneOffset.UTC);

        settlement.markProposed(disputeDeadline, event.getTransactionHash());
        sessionSettlementRepository.saveAndFlush(settlement);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String payloadJson = String.format(
                "{\"agreementId\":\"%s\",\"sessionId\":%d,\"onchainSessionId\":\"%s\",\"outcome\":\"%s\",\"disputeDeadline\":\"%s\",\"proposeTxHash\":\"%s\"}",
                agreement.getId(),
                settlement.getSessionId(),
                settlement.getOnchainSessionId(),
                settlement.getOutcome(),
                disputeDeadline,
                event.getTransactionHash());

        OutboxEvent outboxEvent = OutboxEvent.create(
                "session.settlement.proposed.v1",
                "SessionSettlement",
                settlement.getId().toString(),
                null,
                payloadJson,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        log.info("Successfully transitioned session settlement {} to PROPOSED with dispute deadline {}",
                settlement.getId(), disputeDeadline);
        return true;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateSessionFinalization(UUID settlementId) {
        SessionSettlement settlement = sessionSettlementRepository.findById(settlementId)
                .orElseThrow(() -> new IllegalArgumentException("Session settlement not found: " + settlementId));

        if (settlement.getStatus() != SettlementStatus.PROPOSED) {
            throw new IllegalStateException("Settlement must be in PROPOSED status to finalize, actual: " + settlement.getStatus());
        }

        if (settlement.getDisputeDeadline() != null &&
                OffsetDateTime.now(ZoneOffset.UTC).isBefore(settlement.getDisputeDeadline())) {
            throw new IllegalStateException("Cannot finalize session before dispute deadline: " + settlement.getDisputeDeadline());
        }

        ContractAgreement agreement = settlement.getAgreement();
        String calldata = EduConnectEscrowCalldataEncoder.encodeFinalizeSession(
                agreement.getOnchainAgreementId(),
                settlement.getOnchainSessionId());

        String calldataHash = Hash.sha3(calldata);
        String idempotencyKey = "FINALIZE:" + agreement.getChainId() + ":" + agreement.getId() + ":" + settlement.getSessionId();

        settlement.markFinalizePending();
        sessionSettlementRepository.saveAndFlush(settlement);

        BlockchainTransactionCommand command = new BlockchainTransactionCommand(
                idempotencyKey,
                BlockchainTransactionAction.FINALIZE,
                agreement.getChainId(),
                agreement.getPlatformWallet(),
                agreement.getEscrowContractAddress(),
                calldata,
                calldataHash,
                agreement.getId(),
                settlement.getId(),
                null);

        return commandService.createIntent(command);
    }

    @Transactional
    public boolean processConfirmedSessionSettledEvent(ProcessedEvent event) {
        if (!"SESSION_SETTLED".equalsIgnoreCase(event.getEventType())) {
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
        String onchainSessionId = decodedEvent.sessionId().toLowerCase(Locale.ROOT);

        ContractAgreement agreement = agreementRepository
                .findByChainIdAndOnchainAgreementId(event.getChainId(), onchainAgreementId)
                .orElse(null);

        if (agreement == null) {
            log.warn("No agreement found for chainId {} and onchainAgreementId {}", event.getChainId(), onchainAgreementId);
            return false;
        }

        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndOnchainSessionId(agreement.getId(), onchainSessionId)
                .orElse(null);

        if (settlement == null) {
            log.warn("No session settlement found for agreement {} and onchainSessionId {}",
                    agreement.getId(), onchainSessionId);
            return false;
        }

        if (settlement.getStatus() == SettlementStatus.SETTLED || settlement.getStatus() == SettlementStatus.REFUNDED) {
            log.info("Session settlement {} is already in final status {}", settlement.getId(), settlement.getStatus());
            return true;
        }

        Map<String, String> attrs = decodedEvent.attributes();
        String finalStatusStr = attrs.get("finalStatus"); // 3 = SETTLED, 4 = REFUNDED
        boolean isRefunded = "4".equals(finalStatusStr) || "REFUNDED".equalsIgnoreCase(finalStatusStr);

        if (isRefunded) {
            settlement.markRefunded(event.getTransactionHash());
        } else {
            settlement.markSettled(event.getTransactionHash());
        }
        sessionSettlementRepository.saveAndFlush(settlement);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String eventType = isRefunded ? "session.refunded.v1" : "session.settled.v1";
        String payloadJson = String.format(
                "{\"agreementId\":\"%s\",\"sessionId\":%d,\"onchainSessionId\":\"%s\",\"finalStatus\":\"%s\",\"tutorAmount\":\"%s\",\"platformAmount\":\"%s\",\"studentRefund\":\"%s\",\"finalizeTxHash\":\"%s\"}",
                agreement.getId(),
                settlement.getSessionId(),
                settlement.getOnchainSessionId(),
                settlement.getStatus(),
                attrs.get("tutorAmount"),
                attrs.get("platformAmount"),
                attrs.get("studentRefund"),
                event.getTransactionHash());

        OutboxEvent outboxEvent = OutboxEvent.create(
                eventType,
                "SessionSettlement",
                settlement.getId().toString(),
                null,
                payloadJson,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        // Check if all sessions for the agreement are completed
        List<SessionSettlement> allSettlements = sessionSettlementRepository.findByAgreementId(agreement.getId());
        long settledCount = allSettlements.stream()
                .filter(s -> s.getStatus() == SettlementStatus.SETTLED || s.getStatus() == SettlementStatus.REFUNDED)
                .count();

        if (settledCount >= agreement.getTotalSessions()) {
            agreement.markCompleted();
            agreementRepository.saveAndFlush(agreement);

            String completedPayload = String.format(
                    "{\"agreementId\":\"%s\",\"classroomId\":%d,\"studentId\":%d,\"tutorId\":%d,\"completedAt\":\"%s\"}",
                    agreement.getId(),
                    agreement.getClassroomId(),
                    agreement.getStudentId(),
                    agreement.getTutorId(),
                    now);

            OutboxEvent completedEvent = OutboxEvent.create(
                    "contract.completed.v1",
                    "ContractAgreement",
                    agreement.getId().toString(),
                    null,
                    completedPayload,
                    now);
            outboxEventRepository.saveAndFlush(completedEvent);
            log.info("Agreement {} completed after all {} sessions settled", agreement.getId(), agreement.getTotalSessions());
        }

        log.info("Successfully processed SessionSettled event for settlement {} with status {}",
                settlement.getId(), settlement.getStatus());
        return true;
    }

    public static String computeOnchainSessionId(Long sessionId) {
        return Hash.sha3String("EDUCONNECT:SESSION:" + sessionId);
    }
}
