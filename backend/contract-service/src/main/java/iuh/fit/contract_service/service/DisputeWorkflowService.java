package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EduConnectEscrowCalldataEncoder;
import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.entity.DisputeEvidence;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.DisputeEvidenceRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
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
public class DisputeWorkflowService {
    private static final Logger log = LoggerFactory.getLogger(DisputeWorkflowService.class);

    private final DisputeRepository disputeRepository;
    private final DisputeEvidenceRepository disputeEvidenceRepository;
    private final SessionSettlementRepository sessionSettlementRepository;
    private final ContractAgreementRepository agreementRepository;
    private final BlockchainTransactionCommandService commandService;
    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public DisputeWorkflowService(
            DisputeRepository disputeRepository,
            DisputeEvidenceRepository disputeEvidenceRepository,
            SessionSettlementRepository sessionSettlementRepository,
            ContractAgreementRepository agreementRepository,
            BlockchainTransactionCommandService commandService,
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper) {
        this.disputeRepository = disputeRepository;
        this.disputeEvidenceRepository = disputeEvidenceRepository;
        this.sessionSettlementRepository = sessionSettlementRepository;
        this.agreementRepository = agreementRepository;
        this.commandService = commandService;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateDisputeOpening(
            UUID settlementId,
            Long complainantId,
            String evidenceHash,
            String evidenceObjectKey,
            String contentType,
            String sha256) {

        SessionSettlement settlement = sessionSettlementRepository.findById(settlementId)
                .orElseThrow(() -> new IllegalArgumentException("Session settlement not found: " + settlementId));

        if (settlement.getStatus() != SettlementStatus.PROPOSED) {
            throw new IllegalStateException("Cannot open dispute for session in status: " + settlement.getStatus());
        }
        if (settlement.getOutcome() != SettlementOutcome.BOTH_PRESENT) {
            throw new IllegalStateException("Only sessions proposed with BOTH_PRESENT outcome can be disputed as tutor fraud");
        }
        if (!settlement.getAgreement().getStudentId().equals(complainantId)) {
            throw new SecurityException("Only the student belonging to this agreement can open a tutor fraud dispute");
        }
        if (settlement.getDisputeDeadline() == null || OffsetDateTime.now(ZoneOffset.UTC).isAfter(settlement.getDisputeDeadline())) {
            throw new IllegalStateException("Dispute window has expired on " + settlement.getDisputeDeadline());
        }

        ContractAgreement agreement = settlement.getAgreement();
        String calldata = EduConnectEscrowCalldataEncoder.encodeOpenTutorFraudDispute(
                agreement.getOnchainAgreementId(),
                settlement.getOnchainSessionId(),
                evidenceHash);
        String calldataHash = Hash.sha3(calldata);

        long chainId = agreement.getChainId();
        String idempotencyKey = "OPEN_DISPUTE:" + chainId + ":" + agreement.getId() + ":" + settlement.getSessionId();

        BlockchainTransactionCommand command = new BlockchainTransactionCommand(
                idempotencyKey,
                BlockchainTransactionAction.OPEN_DISPUTE,
                chainId,
                agreement.getPlatformWallet(),
                agreement.getEscrowContractAddress(),
                calldata,
                calldataHash,
                agreement.getId(),
                settlement.getId(),
                null);

        BlockchainTransactionIntentResult intentResult = commandService.createIntent(command);

        Dispute dispute = disputeRepository.findBySettlementId(settlementId).orElse(null);
        if (dispute == null) {
            dispute = Dispute.builder()
                    .id(UUID.randomUUID())
                    .settlement(settlement)
                    .type("TUTOR_FRAUD")
                    .complainantId(complainantId)
                    .submittedAt(Instant.now())
                    .status(DisputeStatus.OPENING)
                    .build();
            disputeRepository.save(dispute);
        }

        DisputeEvidence evidence = DisputeEvidence.builder()
                .id(UUID.randomUUID())
                .dispute(dispute)
                .submittedByUserId(complainantId)
                .submittedByRole("STUDENT")
                .objectKey(evidenceObjectKey)
                .contentType(contentType)
                .sha256(sha256)
                .build();
        disputeEvidenceRepository.save(evidence);

        settlement.markDisputed();
        sessionSettlementRepository.saveAndFlush(settlement);

        log.info("Initiated dispute opening for settlement {} on agreement {}", settlementId, agreement.getId());
        return intentResult;
    }

    @Transactional
    public boolean processConfirmedDisputeOpenedEvent(ProcessedEvent event) {
        if (!"TUTOR_FRAUD_DISPUTE_OPENED".equalsIgnoreCase(event.getEventType())) {
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

        Dispute dispute = disputeRepository.findByOnchainIdentifiers(onchainAgreementId, onchainSessionId)
                .orElse(null);

        if (dispute == null) {
            log.warn("Dispute not found for onchain identifiers: {} / {}", onchainAgreementId, onchainSessionId);
            return false;
        }

        dispute.markOpen(event.getTransactionHash());
        disputeRepository.saveAndFlush(dispute);

        SessionSettlement settlement = dispute.getSettlement();
        if (settlement.getStatus() != SettlementStatus.DISPUTED) {
            settlement.markDisputed();
            sessionSettlementRepository.saveAndFlush(settlement);
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String payloadJson = String.format(
                "{\"disputeId\":\"%s\",\"settlementId\":\"%s\",\"agreementId\":\"%s\",\"complainantId\":%d,\"evidenceHash\":\"%s\",\"openTxHash\":\"%s\"}",
                dispute.getId(),
                settlement.getId(),
                settlement.getAgreement().getId(),
                dispute.getComplainantId(),
                decodedEvent.attributes().get("evidenceHash"),
                event.getTransactionHash());

        OutboxEvent outboxEvent = OutboxEvent.create(
                "dispute.opened.v1",
                "Dispute",
                dispute.getId().toString(),
                null,
                payloadJson,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        log.info("Successfully processed TutorFraudDisputeOpened for dispute {}", dispute.getId());
        return true;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateDisputeResolution(
            UUID disputeId,
            Long resolverUserId,
            String resolverEmail,
            String resolverRole,
            boolean complaintApproved,
            String resolutionReason,
            String resolutionHash) {

        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute not found: " + disputeId));

        if (dispute.getStatus() != DisputeStatus.OPEN && dispute.getStatus() != DisputeStatus.OPENING) {
            throw new IllegalStateException("Cannot resolve dispute in status: " + dispute.getStatus());
        }

        ContractAgreement agreement = dispute.getSettlement().getAgreement();

        // Role-based authorization:
        // ADMIN: authorized for all
        // STAFF: authorized only if they approved the classroom
        if ("ADMIN".equalsIgnoreCase(resolverRole)) {
            // Authorized
        } else if ("STAFF".equalsIgnoreCase(resolverRole)) {
            String reviewerEmail = agreement.getClassroomReviewerEmail();
            if (reviewerEmail == null || !reviewerEmail.equalsIgnoreCase(resolverEmail)) {
                throw new SecurityException("STAFF " + resolverEmail + " is not authorized to resolve dispute for classroom approved by: " + reviewerEmail);
            }
        } else {
            throw new SecurityException("Invalid role for dispute resolution: " + resolverRole);
        }

        SessionSettlement settlement = dispute.getSettlement();
        String calldata = EduConnectEscrowCalldataEncoder.encodeResolveTutorFraudDispute(
                agreement.getOnchainAgreementId(),
                settlement.getOnchainSessionId(),
                complaintApproved,
                resolutionHash);
        String calldataHash = Hash.sha3(calldata);

        long chainId = agreement.getChainId();
        String idempotencyKey = "RESOLVE:" + chainId + ":" + agreement.getId() + ":" + settlement.getSessionId();

        BlockchainTransactionCommand command = new BlockchainTransactionCommand(
                idempotencyKey,
                BlockchainTransactionAction.RESOLVE,
                chainId,
                agreement.getPlatformWallet(),
                agreement.getEscrowContractAddress(),
                calldata,
                calldataHash,
                agreement.getId(),
                settlement.getId(),
                null);

        BlockchainTransactionIntentResult intentResult = commandService.createIntent(command);

        dispute.setResolutionReason(resolutionReason);
        dispute.setResolvedByUserId(resolverUserId);
        dispute.setResolvedByEmail(resolverEmail);
        dispute.setResolvedByRole(resolverRole.toUpperCase(Locale.ROOT));
        dispute.markResolutionPending();
        disputeRepository.saveAndFlush(dispute);

        log.info("Initiated dispute resolution for dispute {} by {} ({}) with approved={}",
                disputeId, resolverEmail, resolverRole, complaintApproved);
        return intentResult;
    }

    @Transactional
    public boolean processConfirmedDisputeResolvedEvent(ProcessedEvent event) {
        if (!"TUTOR_FRAUD_DISPUTE_RESOLVED".equalsIgnoreCase(event.getEventType())) {
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
        boolean complaintApproved = Boolean.parseBoolean(decodedEvent.attributes().get("complaintApproved"));

        Dispute dispute = disputeRepository.findByOnchainIdentifiers(onchainAgreementId, onchainSessionId)
                .orElse(null);

        if (dispute == null) {
            log.warn("Dispute not found for onchain identifiers: {} / {}", onchainAgreementId, onchainSessionId);
            return false;
        }

        dispute.markResolved(
                complaintApproved,
                dispute.getResolutionReason(),
                dispute.getResolvedByUserId(),
                dispute.getResolvedByEmail(),
                dispute.getResolvedByRole(),
                event.getTransactionHash());
        disputeRepository.saveAndFlush(dispute);

        SessionSettlement settlement = dispute.getSettlement();
        if (complaintApproved) {
            settlement.markRefunded(event.getTransactionHash());
        } else {
            settlement.markSettled(event.getTransactionHash());
        }
        sessionSettlementRepository.saveAndFlush(settlement);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        ContractAgreement agreement = settlement.getAgreement();

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
            log.info("Agreement {} completed after resolving all {} sessions", agreement.getId(), agreement.getTotalSessions());
        }

        String resolvedPayload = String.format(
                "{\"disputeId\":\"%s\",\"settlementId\":\"%s\",\"agreementId\":\"%s\",\"complaintApproved\":%b,\"resolutionHash\":\"%s\",\"resolvedByUserId\":%d,\"resolvedByEmail\":\"%s\",\"resolvedByRole\":\"%s\",\"resolveTxHash\":\"%s\"}",
                dispute.getId(),
                settlement.getId(),
                agreement.getId(),
                complaintApproved,
                decodedEvent.attributes().get("resolutionHash"),
                dispute.getResolvedByUserId() != null ? dispute.getResolvedByUserId() : 0,
                dispute.getResolvedByEmail() != null ? dispute.getResolvedByEmail() : "",
                dispute.getResolvedByRole() != null ? dispute.getResolvedByRole() : "",
                event.getTransactionHash());

        OutboxEvent outboxEvent = OutboxEvent.create(
                "dispute.resolved.v1",
                "Dispute",
                dispute.getId().toString(),
                null,
                resolvedPayload,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        log.info("Successfully processed TutorFraudDisputeResolved for dispute {} (approved={})", dispute.getId(), complaintApproved);
        return true;
    }
}
