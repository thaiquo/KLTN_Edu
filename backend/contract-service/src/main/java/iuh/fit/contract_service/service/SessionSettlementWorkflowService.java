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

import java.math.BigInteger;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    private final java.time.Clock clock;

    public SessionSettlementWorkflowService(
            ContractAgreementRepository agreementRepository,
            SessionSettlementRepository sessionSettlementRepository,
            BlockchainTransactionCommandService commandService,
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper, java.time.Clock clock) {
        this.agreementRepository = agreementRepository;
        this.sessionSettlementRepository = sessionSettlementRepository;
        this.commandService = commandService;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateSessionProposal(
            UUID agreementId, Long sessionId, SettlementOutcome outcome, String evidenceHash) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));

        if (agreement.getStatus() != ContractAgreementStatus.ACTIVE) {
            throw new IllegalStateException("Agreement must be in ACTIVE status to propose session, actual: " + agreement.getStatus());
        }
        if (sessionId == null || sessionId <= 0 || sessionId > agreement.getTotalSessions()) {
            throw new IllegalArgumentException("sessionId must be between 1 and totalSessions (" + agreement.getTotalSessions() + ")");
        }

        String onchainSessionId = computeOnchainSessionId(sessionId);
        SessionSettlement settlement = sessionSettlementRepository.findByAgreementIdAndSessionId(agreementId, sessionId)
                .map(existing -> {
                    if (existing.getStatus() != SettlementStatus.PREPARING
                            && existing.getStatus() != SettlementStatus.PROPOSE_PENDING) {
                        throw new IllegalStateException("Session settlement already moved past proposal: " + existing.getStatus());
                    }
                    if (existing.getOutcome() != outcome
                            || !existing.getProposalEvidenceHash().equalsIgnoreCase(evidenceHash)) {
                        throw new IllegalStateException("Existing session proposal does not match requested outcome/evidence hash");
                    }
                    return existing;
                })
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
        requireEventValue(attrs.get("outcome"), String.valueOf(settlement.getOutcome().ordinal()), "outcome");
        requireEventValue(attrs.get("evidenceHash"), settlement.getProposalEvidenceHash(), "evidenceHash");

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

        if (settlement.getDisputeDeadline() == null ||
                !OffsetDateTime.now(clock).isAfter(settlement.getDisputeDeadline())) {
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
        BigInteger tutorAmount = parseUnits(attrs.get("tutorAmount"), "tutorAmount");
        BigInteger platformAmount = parseUnits(attrs.get("platformAmount"), "platformAmount");
        BigInteger studentRefund = parseUnits(attrs.get("studentRefund"), "studentRefund");

        validateSettlementDistribution(settlement, isRefunded, tutorAmount, platformAmount, studentRefund);

        if (isRefunded) {
            settlement.markRefunded(event.getTransactionHash());
        } else {
            settlement.markSettled(event.getTransactionHash());
        }
        settlement.recordDistribution(tutorAmount, platformAmount, studentRefund);
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

        log.info("Successfully processed SessionSettled event for settlement {} with status {}",
                settlement.getId(), settlement.getStatus());
        return true;
    }

    public static String computeOnchainSessionId(Long sessionId) {
        return Hash.sha3String("EDUCONNECT:SESSION:" + sessionId);
    }

    private static void requireEventValue(String actual, String expected, String name) {
        if (actual == null || expected == null || !actual.equalsIgnoreCase(expected)) {
            throw new IllegalStateException("Confirmed event " + name + " does not match local command state");
        }
    }

    private static BigInteger parseUnits(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Confirmed event missing " + name);
        }
        return new BigInteger(value);
    }

    private static void validateSettlementDistribution(
            SessionSettlement settlement,
            boolean isRefunded,
            BigInteger tutorAmount,
            BigInteger platformAmount,
            BigInteger studentRefund) {
        BigInteger amount = settlement.getAmount();
        BigInteger normalTutor = amount.multiply(BigInteger.valueOf(8500)).divide(BigInteger.valueOf(10000));
        BigInteger normalPlatform = amount.multiply(BigInteger.valueOf(1500)).divide(BigInteger.valueOf(10000));
        BigInteger normalRefund = amount.subtract(normalTutor).subtract(normalPlatform);
        BigInteger absentTutor = amount.multiply(BigInteger.valueOf(4500)).divide(BigInteger.valueOf(10000));
        BigInteger absentPlatform = amount.multiply(BigInteger.valueOf(1000)).divide(BigInteger.valueOf(10000));
        BigInteger absentRefund = amount.subtract(absentTutor).subtract(absentPlatform);

        boolean valid;
        if (settlement.getStatus() == SettlementStatus.DISPUTED && settlement.getOutcome() == SettlementOutcome.BOTH_PRESENT) {
            valid = (!isRefunded && tutorAmount.equals(normalTutor) && platformAmount.equals(normalPlatform) && studentRefund.equals(normalRefund))
                    || (isRefunded && tutorAmount.equals(BigInteger.ZERO) && platformAmount.equals(BigInteger.ZERO) && studentRefund.equals(amount));
        } else if (settlement.getOutcome() == SettlementOutcome.BOTH_PRESENT) {
            valid = !isRefunded
                    && tutorAmount.equals(normalTutor)
                    && platformAmount.equals(normalPlatform)
                    && studentRefund.equals(normalRefund);
        } else if (settlement.getOutcome() == SettlementOutcome.STUDENT_ABSENT_TUTOR_PRESENT) {
            valid = !isRefunded
                    && tutorAmount.equals(absentTutor)
                    && platformAmount.equals(absentPlatform)
                    && studentRefund.equals(absentRefund);
        } else {
            valid = isRefunded
                    && tutorAmount.equals(BigInteger.ZERO)
                    && platformAmount.equals(BigInteger.ZERO)
                    && studentRefund.equals(amount);
        }

        if (!valid) {
            throw new IllegalStateException("Confirmed SessionSettled amounts do not match Solidity distribution semantics");
        }
    }
}
