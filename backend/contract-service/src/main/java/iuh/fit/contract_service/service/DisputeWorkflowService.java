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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
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
    private final NotificationDispatcher notificationDispatcher;

    public DisputeWorkflowService(
            DisputeRepository disputeRepository,
            DisputeEvidenceRepository disputeEvidenceRepository,
            SessionSettlementRepository sessionSettlementRepository,
            ContractAgreementRepository agreementRepository,
            BlockchainTransactionCommandService commandService,
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper,
            NotificationDispatcher notificationDispatcher) {
        this.disputeRepository = disputeRepository;
        this.disputeEvidenceRepository = disputeEvidenceRepository;
        this.sessionSettlementRepository = sessionSettlementRepository;
        this.agreementRepository = agreementRepository;
        this.commandService = commandService;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
        this.notificationDispatcher = notificationDispatcher;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateDisputeOpening(
            UUID settlementId,
            Long complainantId,
            String complainantRole,
            String reason,
            String evidenceHash,
            String evidenceObjectKey,
            String contentType,
            String sha256) {

        String normalizedRole = complainantRole != null ? complainantRole.trim().toUpperCase(Locale.ROOT) : "";
        if (!"STUDENT".equals(normalizedRole) && !"TUTOR".equals(normalizedRole)) {
            throw new IllegalArgumentException("Complainant role must be STUDENT or TUTOR");
        }
        String normalizedReason = reason != null ? reason.trim() : "";
        if (normalizedReason.isBlank()) {
            throw new IllegalArgumentException("Dispute reason is required");
        }
        if (normalizedReason.length() > 2000) {
            throw new IllegalArgumentException("Dispute reason must not exceed 2000 characters");
        }

        SessionSettlement settlement = sessionSettlementRepository.findById(settlementId)
                .orElseThrow(() -> new IllegalArgumentException("Session settlement not found: " + settlementId));

        if (settlement.getStatus() != SettlementStatus.PROPOSED) {
            throw new IllegalStateException("Cannot open dispute for session in status: " + settlement.getStatus());
        }
        if (settlement.getOutcome() != SettlementOutcome.BOTH_PRESENT) {
            throw new IllegalStateException("Only sessions proposed with BOTH_PRESENT outcome can be disputed as tutor fraud");
        }
        ContractAgreement agreement = settlement.getAgreement();
        Long expectedComplainantId = "STUDENT".equals(normalizedRole)
                ? agreement.getStudentId()
                : agreement.getTutorId();
        if (!expectedComplainantId.equals(complainantId)) {
            throw new SecurityException("Only the " + normalizedRole.toLowerCase(Locale.ROOT)
                    + " belonging to this agreement can open this dispute");
        }
        if (settlement.getDisputeDeadline() == null || OffsetDateTime.now(ZoneOffset.UTC).isAfter(settlement.getDisputeDeadline())) {
            throw new IllegalStateException("Dispute window has expired on " + settlement.getDisputeDeadline());
        }

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
        boolean newlyCreated = dispute == null;
        if (dispute == null) {
            dispute = Dispute.builder()
                    .id(UUID.randomUUID())
                    .settlement(settlement)
                    .type("STUDENT".equals(normalizedRole) ? "TUTOR_FRAUD" : "STUDENT_MISCONDUCT")
                    .reason(normalizedReason)
                    .complainantId(complainantId)
                    .complainantRole(normalizedRole)
                    .submittedAt(Instant.now())
                    .status(DisputeStatus.OPENING)
                    .build();
            disputeRepository.save(dispute);
        }

        saveEvidenceIfPresent(dispute, complainantId, normalizedRole, evidenceObjectKey, contentType, sha256);

        settlement.markDisputeOpening();
        sessionSettlementRepository.saveAndFlush(settlement);

        if (newlyCreated && "STUDENT".equals(normalizedRole)) {
            notificationDispatcher.sendAsync(
                    agreement.getTutorEmail(),
                    agreement.getTutorId(),
                    "Học viên khiếu nại Buổi #" + settlement.getSessionId(),
                    "Học viên đã gửi khiếu nại cho " + safeClassName(agreement)
                            + ". Nội dung: " + abbreviate(dispute.getReason(), 700)
                            + ". Khoản quyết toán của học viên này đã được tạm giữ; vui lòng vào mục Khiếu nại lớp học để xem và phản hồi.",
                    "DISPUTE_OPENED",
                    "DISPUTE",
                    dispute.getId().toString());
        }

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

        if (dispute.getStatus() == DisputeStatus.OPEN
                || dispute.getStatus() == DisputeStatus.RESOLUTION_PENDING
                || dispute.getStatus() == DisputeStatus.APPROVED
                || dispute.getStatus() == DisputeStatus.REJECTED) {
            log.info("Dispute {} already moved past opening with status {}", dispute.getId(), dispute.getStatus());
            return true;
        }

        String eventEvidenceHash = decodedEvent.attributes().get("evidenceHash");
        if (eventEvidenceHash == null || eventEvidenceHash.isBlank()) {
            throw new IllegalStateException("Confirmed dispute event missing evidenceHash");
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
                eventEvidenceHash,
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
    public Dispute submitTutorResponse(
            UUID disputeId,
            Long tutorId,
            String responseText,
            String evidenceObjectKey) {
        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new IllegalArgumentException("Dispute not found: " + disputeId));
        if (dispute.getStatus() != DisputeStatus.OPEN) {
            throw new IllegalStateException("Only open disputes accept tutor evidence");
        }
        if (!"STUDENT".equalsIgnoreCase(dispute.getComplainantRole())) {
            throw new IllegalStateException("Tutor responses are only accepted for Student-originated disputes");
        }

        ContractAgreement agreement = dispute.getSettlement().getAgreement();
        if (tutorId == null || !tutorId.equals(agreement.getTutorId())) {
            throw new SecurityException("Only the tutor belonging to this agreement can respond to the dispute");
        }

        String normalizedResponse = responseText != null ? responseText.trim() : "";
        if (normalizedResponse.isBlank()) {
            throw new IllegalArgumentException("Tutor response is required");
        }
        if (normalizedResponse.length() > 4000) {
            throw new IllegalArgumentException("Tutor response must not exceed 4000 characters");
        }

        dispute.setTutorResponse(normalizedResponse);
        dispute.setTutorRespondedAt(Instant.now());
        Dispute saved = disputeRepository.save(dispute);
        saveEvidenceIfPresent(saved, tutorId, "TUTOR", evidenceObjectKey, "text/uri-list", null);

        return saved;
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

        if (dispute.getStatus() != DisputeStatus.OPEN) {
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
        // V1 exposes a tutor-fraud boolean only. For a Tutor-originated complaint,
        // approving the complainant means choosing the normal Tutor payout branch,
        // which is the inverse of approving a Student tutor-fraud complaint.
        boolean onchainComplaintApproved = "TUTOR".equalsIgnoreCase(dispute.getComplainantRole())
                ? !complaintApproved
                : complaintApproved;
        String calldata = EduConnectEscrowCalldataEncoder.encodeResolveTutorFraudDispute(
                agreement.getOnchainAgreementId(),
                settlement.getOnchainSessionId(),
                onchainComplaintApproved,
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
        boolean onchainComplaintApproved = Boolean.parseBoolean(decodedEvent.attributes().get("complaintApproved"));

        Dispute dispute = disputeRepository.findByOnchainIdentifiers(onchainAgreementId, onchainSessionId)
                .orElse(null);

        if (dispute == null) {
            log.warn("Dispute not found for onchain identifiers: {} / {}", onchainAgreementId, onchainSessionId);
            return false;
        }

        if (dispute.getStatus() == DisputeStatus.APPROVED || dispute.getStatus() == DisputeStatus.REJECTED) {
            log.info("Dispute {} already resolved with status {}", dispute.getId(), dispute.getStatus());
            return true;
        }

        String resolutionHash = decodedEvent.attributes().get("resolutionHash");
        if (resolutionHash == null || resolutionHash.isBlank()) {
            throw new IllegalStateException("Confirmed dispute resolution event missing resolutionHash");
        }

        boolean complaintApproved = "TUTOR".equalsIgnoreCase(dispute.getComplainantRole())
                ? !onchainComplaintApproved
                : onchainComplaintApproved;
        dispute.markResolved(
                complaintApproved,
                dispute.getResolutionReason(),
                dispute.getResolvedByUserId(),
                dispute.getResolvedByEmail(),
                dispute.getResolvedByRole(),
                event.getTransactionHash());
        disputeRepository.saveAndFlush(dispute);

        SessionSettlement settlement = dispute.getSettlement();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        ContractAgreement agreement = settlement.getAgreement();

        String resolvedPayload = String.format(
                "{\"disputeId\":\"%s\",\"settlementId\":\"%s\",\"agreementId\":\"%s\",\"complaintApproved\":%b,\"resolutionHash\":\"%s\",\"resolvedByUserId\":%d,\"resolvedByEmail\":\"%s\",\"resolvedByRole\":\"%s\",\"resolveTxHash\":\"%s\"}",
                dispute.getId(),
                settlement.getId(),
                agreement.getId(),
                complaintApproved,
                resolutionHash,
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

        boolean tutorOriginated = "TUTOR".equalsIgnoreCase(dispute.getComplainantRole());
        String resultText;
        if (tutorOriginated) {
            resultText = complaintApproved
                    ? "Khiếu nại của bạn đã được chấp thuận; buổi học sẽ theo nhánh thanh toán cho gia sư sau xác nhận on-chain."
                    : "Khiếu nại của bạn đã bị bác; buổi học sẽ theo nhánh hoàn tiền cho học viên sau xác nhận on-chain.";
        } else {
            resultText = complaintApproved
                    ? "Khiếu nại đã được chấp thuận; buổi học sẽ hoàn 100% cho học viên sau xác nhận quyết toán on-chain."
                    : "Khiếu nại đã bị bác bỏ; buổi học sẽ được quyết toán cho gia sư theo phán quyết on-chain.";
        }
        // Tutor-originated complaints are private operational reports to Staff/Admin.
        if (!tutorOriginated) {
            notificationDispatcher.sendAsync(
                    agreement.getStudentEmail(), agreement.getStudentId(),
                    "Đã phân xử khiếu nại Buổi #" + settlement.getSessionId(),
                    resultText,
                    "DISPUTE_RESOLVED", "DISPUTE", dispute.getId().toString());
        }
        notificationDispatcher.sendAsync(
                agreement.getTutorEmail(), agreement.getTutorId(),
                "Đã phân xử khiếu nại Buổi #" + settlement.getSessionId(),
                resultText,
                "DISPUTE_RESOLVED", "DISPUTE", dispute.getId().toString());

        log.info("Successfully processed TutorFraudDisputeResolved for dispute {} (approved={})", dispute.getId(), complaintApproved);
        return true;
    }

    private void saveEvidenceIfPresent(
            Dispute dispute,
            Long submittedByUserId,
            String submittedByRole,
            String objectKey,
            String contentType,
            String suppliedSha256) {
        String normalizedObjectKey = objectKey != null ? objectKey.trim() : "";
        if (normalizedObjectKey.isBlank()) {
            return;
        }
        if (normalizedObjectKey.length() > 1024) {
            throw new IllegalArgumentException("Evidence link must not exceed 1024 characters");
        }
        if (disputeEvidenceRepository.existsByDisputeIdAndObjectKey(dispute.getId(), normalizedObjectKey)) {
            return;
        }

        String normalizedSha256 = suppliedSha256 != null ? suppliedSha256.trim().toLowerCase(Locale.ROOT) : "";
        if (!normalizedSha256.matches("[0-9a-f]{64}")) {
            normalizedSha256 = sha256(normalizedObjectKey);
        }
        DisputeEvidence evidence = DisputeEvidence.builder()
                .id(UUID.randomUUID())
                .dispute(dispute)
                .submittedByUserId(submittedByUserId)
                .submittedByRole(submittedByRole)
                .objectKey(normalizedObjectKey)
                .contentType(contentType)
                .sha256(normalizedSha256)
                .build();
        disputeEvidenceRepository.save(evidence);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private String safeClassName(ContractAgreement agreement) {
        return agreement.getClassName() != null && !agreement.getClassName().isBlank()
                ? "lớp " + agreement.getClassName()
                : "buổi học này";
    }

    private String abbreviate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value != null ? value : "";
        }
        return value.substring(0, maxLength - 1) + "…";
    }
}
