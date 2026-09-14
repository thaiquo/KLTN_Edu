package iuh.fit.contract_service.api;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.config.security.ContractAccessControl;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.entity.DisputeEvidence;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.DisputeEvidenceRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import iuh.fit.contract_service.service.DisputeEvidenceStorageService;
import iuh.fit.contract_service.service.DisputeWorkflowService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.crypto.Hash;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/contracts")
public class DisputeEvidenceController {
    private final ContractAgreementRepository agreements;
    private final SessionSettlementRepository settlements;
    private final DisputeRepository disputes;
    private final DisputeEvidenceRepository evidenceRepository;
    private final DisputeWorkflowService workflow;
    private final DisputeEvidenceStorageService evidenceStorage;
    private final CurrentUserContext currentUserContext;
    private final ContractAccessControl accessControl;

    public DisputeEvidenceController(
            ContractAgreementRepository agreements,
            SessionSettlementRepository settlements,
            DisputeRepository disputes,
            DisputeEvidenceRepository evidenceRepository,
            DisputeWorkflowService workflow,
            DisputeEvidenceStorageService evidenceStorage,
            CurrentUserContext currentUserContext,
            ContractAccessControl accessControl) {
        this.agreements = agreements;
        this.settlements = settlements;
        this.disputes = disputes;
        this.evidenceRepository = evidenceRepository;
        this.workflow = workflow;
        this.evidenceStorage = evidenceStorage;
        this.currentUserContext = currentUserContext;
        this.accessControl = accessControl;
    }

    @PostMapping(
            value = "/agreements/{agreementId}/settlements/{sessionId}/dispute-file",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> openDisputeWithFile(
            @PathVariable UUID agreementId,
            @PathVariable Long sessionId,
            @RequestParam String reason,
            @RequestPart("file") MultipartFile file) {
        DisputeEvidenceStorageService.StoredEvidence stored = null;
        try {
            ContractUserPrincipal user = currentUserContext.requireCurrentUser();
            var agreement = agreements.findById(agreementId)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
            accessControl.requireCanOpenDispute(agreement, user);
            var settlement = settlements.findByAgreementIdAndSessionId(agreementId, sessionId)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Settlement not found"));
            String normalizedReason = reason == null ? "" : reason.trim();
            stored = evidenceStorage.store(agreementId, sessionId, user.activeRole(), file);
            String evidenceHash = Hash.sha3String(
                    "DISPUTE:" + agreementId + ":" + sessionId + ":" + normalizedReason + ":" + stored.sha256());
            BlockchainTransactionIntentResult result = workflow.initiateDisputeOpening(
                    settlement.getId(), user.userId(), user.activeRole(), normalizedReason, evidenceHash,
                    stored.objectKey(), stored.contentType(), stored.sha256());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "agreementId", agreementId.toString(),
                    "settlementId", settlement.getId().toString(),
                    "transactionStatus", result.status().name(),
                    "filename", stored.originalFilename(),
                    "sha256", stored.sha256()));
        } catch (ResponseStatusException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            throw ex;
        } catch (SecurityException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            return ResponseEntity.badRequest().body(Map.of("error", safeMessage(ex)));
        }
    }

    @PutMapping(value = "/disputes/{id}/tutor-evidence-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> submitTutorEvidenceFile(
            @PathVariable UUID id,
            @RequestParam String responseText,
            @RequestPart("file") MultipartFile file) {
        DisputeEvidenceStorageService.StoredEvidence stored = null;
        try {
            Dispute dispute = disputes.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Dispute not found"));
            ContractUserPrincipal user = currentUserContext.requireCurrentUser();
            accessControl.requireCanSign(dispute.getSettlement().getAgreement(), "TUTOR", user);
            if (!"STUDENT".equalsIgnoreCase(dispute.getComplainantRole())) {
                throw new IllegalStateException("Tutor chỉ được phản hồi khiếu nại do học viên gửi.");
            }
            if (dispute.getStatus() != DisputeStatus.OPEN) {
                throw new IllegalStateException("Chỉ khiếu nại đang mở mới nhận minh chứng gia sư.");
            }
            stored = evidenceStorage.store(
                    dispute.getSettlement().getAgreement().getId(),
                    dispute.getSettlement().getSessionId(), "TUTOR", file);
            workflow.submitTutorResponse(
                    id, user.userId(), responseText, stored.objectKey(), stored.contentType(), stored.sha256());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "disputeId", id.toString(),
                    "filename", stored.originalFilename(),
                    "sha256", stored.sha256()));
        } catch (ResponseStatusException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            throw ex;
        } catch (SecurityException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            return ResponseEntity.status(403).body(Map.of("error", ex.getMessage()));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            return ResponseEntity.badRequest().body(Map.of("error", safeMessage(ex)));
        }
    }

    @GetMapping("/disputes/{disputeId}/evidence/{evidenceId}/content")
    public ResponseEntity<byte[]> readEvidence(
            @PathVariable UUID disputeId,
            @PathVariable UUID evidenceId) {
        Dispute dispute = disputes.findById(disputeId)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Dispute not found"));
        ContractUserPrincipal user = currentUserContext.requireCurrentUser();
        if (!accessControl.canViewDispute(dispute, user)
                && !user.hasActiveAuthority("STAFF")
                && !user.hasActiveAuthority("ADMIN")) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Evidence not found");
        }
        if (user.hasActiveAuthority("STAFF")
                && !user.matchesEmail(dispute.getSettlement().getAgreement().getClassroomReviewerEmail())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Evidence not found");
        }
        DisputeEvidence evidence = evidenceRepository.findById(evidenceId)
                .filter(item -> item.getDispute().getId().equals(disputeId))
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Evidence not found"));
        byte[] bytes = evidenceStorage.read(evidence.getObjectKey());
        MediaType contentType;
        try {
            contentType = MediaType.parseMediaType(evidence.getContentType());
        } catch (Exception ignored) {
            contentType = MediaType.APPLICATION_OCTET_STREAM;
        }
        String filename = evidenceStorage.filename(evidence.getObjectKey()).replace("\"", "_");
        return ResponseEntity.ok()
                .contentType(contentType)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .body(bytes);
    }

    private String safeMessage(RuntimeException ex) {
        return ex.getMessage() != null ? ex.getMessage() : "Không thể xử lý file minh chứng.";
    }
}
