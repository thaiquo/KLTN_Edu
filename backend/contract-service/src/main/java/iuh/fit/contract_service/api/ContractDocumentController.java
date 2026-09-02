package iuh.fit.contract_service.api;

import iuh.fit.contract_service.api.dto.ContractDocumentViewDto;
import iuh.fit.contract_service.api.dto.ContractDocumentArtifactDto;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractDocumentArtifactStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.service.ContractDocumentArtifactService;
import iuh.fit.contract_service.service.ContractDocumentQueryService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/contracts/agreements")
public class ContractDocumentController {

    private final ContractAgreementRepository agreementRepository;
    private final ContractDocumentQueryService documentQueryService;
    private final ContractDocumentArtifactService artifactService;

    public ContractDocumentController(
            ContractAgreementRepository agreementRepository,
            ContractDocumentQueryService documentQueryService,
            ContractDocumentArtifactService artifactService) {
        this.agreementRepository = agreementRepository;
        this.documentQueryService = documentQueryService;
        this.artifactService = artifactService;
    }

    @GetMapping("/{id}/document-view")
    public ResponseEntity<ContractDocumentViewDto> getDocumentView(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Role", required = false) String headerRole,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-User-Email", required = false) String headerEmail,
            @RequestParam(value = "role", required = false) String paramRole,
            @RequestParam(value = "userId", required = false) Long paramUserId,
            @RequestParam(value = "email", required = false) String paramEmail) {
        String role = (paramRole != null && !paramRole.isBlank()) ? paramRole : ((headerRole != null && !headerRole.isBlank()) ? headerRole : "ALL");
        Long userId = (paramUserId != null && paramUserId > 0) ? paramUserId : ((headerUserId != null && headerUserId > 0) ? headerUserId : 0L);
        String email = (paramEmail != null && !paramEmail.isBlank()) ? paramEmail.trim() : ((headerEmail != null && !headerEmail.isBlank()) ? headerEmail.trim() : "");

        if (!isAuthorizedForAgreement(id, role, userId, email)) {
            return ResponseEntity.notFound().build();
        }
        return documentQueryService.findDocumentView(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/document-artifact")
    public ResponseEntity<ContractDocumentArtifactDto> getArtifact(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Role", required = false) String headerRole,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-User-Email", required = false) String headerEmail,
            @RequestParam(value = "role", required = false) String paramRole,
            @RequestParam(value = "userId", required = false) Long paramUserId,
            @RequestParam(value = "email", required = false) String paramEmail) {
        String role = (paramRole != null && !paramRole.isBlank()) ? paramRole : ((headerRole != null && !headerRole.isBlank()) ? headerRole : "ALL");
        Long userId = (paramUserId != null && paramUserId > 0) ? paramUserId : ((headerUserId != null && headerUserId > 0) ? headerUserId : 0L);
        String email = (paramEmail != null && !paramEmail.isBlank()) ? paramEmail.trim() : ((headerEmail != null && !headerEmail.isBlank()) ? headerEmail.trim() : "");

        if (!isAuthorizedForAgreement(id, role, userId, email)) {
            return ResponseEntity.notFound().build();
        }
        return artifactService.find(id)
                .map(ContractDocumentArtifactDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/document-artifact/finalize")
    public ResponseEntity<?> finalizeArtifact(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Role", required = false) String headerRole,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-User-Email", required = false) String headerEmail,
            @RequestParam(value = "role", required = false) String paramRole,
            @RequestParam(value = "userId", required = false) Long paramUserId,
            @RequestParam(value = "email", required = false) String paramEmail) {
        String role = (paramRole != null && !paramRole.isBlank()) ? paramRole : ((headerRole != null && !headerRole.isBlank()) ? headerRole : "ALL");
        Long userId = (paramUserId != null && paramUserId > 0) ? paramUserId : ((headerUserId != null && headerUserId > 0) ? headerUserId : 0L);
        String email = (paramEmail != null && !paramEmail.isBlank()) ? paramEmail.trim() : ((headerEmail != null && !headerEmail.isBlank()) ? headerEmail.trim() : "");

        if (!isAuthorizedForAgreement(id, role, userId, email)) {
            return ResponseEntity.notFound().build();
        }
        try {
            var artifact = artifactService.finalizeDocument(id);
            var body = ContractDocumentArtifactDto.from(artifact);
            return artifact.getStatus() == ContractDocumentArtifactStatus.READY
                    ? ResponseEntity.ok(body)
                    : ResponseEntity.status(422).body(body);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(java.util.Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/{id}/document-artifact/preview")
    public ResponseEntity<byte[]> previewPdf(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Role", required = false) String headerRole,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-User-Email", required = false) String headerEmail,
            @RequestParam(value = "role", required = false) String paramRole,
            @RequestParam(value = "userId", required = false) Long paramUserId,
            @RequestParam(value = "email", required = false) String paramEmail) {
        String role = (paramRole != null && !paramRole.isBlank()) ? paramRole : ((headerRole != null && !headerRole.isBlank()) ? headerRole : "ALL");
        Long userId = (paramUserId != null && paramUserId > 0) ? paramUserId : ((headerUserId != null && headerUserId > 0) ? headerUserId : 0L);
        String email = (paramEmail != null && !paramEmail.isBlank()) ? paramEmail.trim() : ((headerEmail != null && !headerEmail.isBlank()) ? headerEmail.trim() : "");

        if (!isAuthorizedForAgreement(id, role, userId, email)) {
            return ResponseEntity.notFound().build();
        }
        return fileResponse(id, "pdf", false);
    }

    @GetMapping("/{id}/document-artifact/download")
    public ResponseEntity<byte[]> download(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "pdf") String format,
            @RequestHeader(value = "X-User-Role", required = false) String headerRole,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-User-Email", required = false) String headerEmail,
            @RequestParam(value = "role", required = false) String paramRole,
            @RequestParam(value = "userId", required = false) Long paramUserId,
            @RequestParam(value = "email", required = false) String paramEmail) {
        String role = (paramRole != null && !paramRole.isBlank()) ? paramRole : ((headerRole != null && !headerRole.isBlank()) ? headerRole : "ALL");
        Long userId = (paramUserId != null && paramUserId > 0) ? paramUserId : ((headerUserId != null && headerUserId > 0) ? headerUserId : 0L);
        String email = (paramEmail != null && !paramEmail.isBlank()) ? paramEmail.trim() : ((headerEmail != null && !headerEmail.isBlank()) ? headerEmail.trim() : "");

        if (!isAuthorizedForAgreement(id, role, userId, email)) {
            return ResponseEntity.notFound().build();
        }
        if (!"pdf".equalsIgnoreCase(format) && !"docx".equalsIgnoreCase(format)) {
            return ResponseEntity.badRequest().build();
        }
        return fileResponse(id, format.toLowerCase(), true);
    }

    private ResponseEntity<byte[]> fileResponse(UUID id, String format, boolean attachment) {
        try {
            byte[] bytes = artifactService.read(id, format);
            String filename = "educonnect-contract-" + id + "." + format;
            MediaType contentType = "docx".equals(format)
                    ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                    : MediaType.APPLICATION_PDF;
            String disposition = (attachment ? "attachment" : "inline") + "; filename=\"" + filename + "\"";
            return ResponseEntity.ok()
                    .contentType(contentType)
                    .contentLength(bytes.length)
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                    .header("X-Content-Type-Options", "nosniff")
                    .body(bytes);
        } catch (IllegalStateException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    private boolean isAuthorizedForAgreement(UUID agreementId, String role, Long userId, String email) {
        ContractAgreement agreement = agreementRepository.findById(agreementId).orElse(null);
        if (agreement == null) {
            return false;
        }
        if ("ADMIN".equalsIgnoreCase(role) || "STAFF".equalsIgnoreCase(role)) {
            return true;
        }
        if ((userId == null || userId == 0) && (email == null || email.isBlank())) {
            return true;
        }
        if (userId != null && userId > 0 && (userId.equals(agreement.getStudentId()) || userId.equals(agreement.getTutorId()))) {
            return true;
        }
        if (email != null && !email.isBlank()) {
            return email.equalsIgnoreCase(agreement.getStudentEmail())
                    || email.equalsIgnoreCase(agreement.getTutorEmail())
                    || email.equalsIgnoreCase(agreement.getClassroomReviewerEmail());
        }
        return false;
    }
}
