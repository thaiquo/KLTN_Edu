package iuh.fit.contract_service.api;

import iuh.fit.contract_service.api.dto.ContractDocumentViewDto;
import iuh.fit.contract_service.api.dto.ContractDocumentArtifactDto;
import iuh.fit.contract_service.enums.ContractDocumentArtifactStatus;
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

    private final ContractDocumentQueryService documentQueryService;
    private final ContractDocumentArtifactService artifactService;

    public ContractDocumentController(
            ContractDocumentQueryService documentQueryService,
            ContractDocumentArtifactService artifactService) {
        this.documentQueryService = documentQueryService;
        this.artifactService = artifactService;
    }

    @GetMapping("/{id}/document-view")
    public ResponseEntity<ContractDocumentViewDto> getDocumentView(@PathVariable UUID id) {
        return documentQueryService.findDocumentView(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/document-artifact")
    public ResponseEntity<ContractDocumentArtifactDto> getArtifact(@PathVariable UUID id) {
        return artifactService.find(id)
                .map(ContractDocumentArtifactDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/document-artifact/finalize")
    public ResponseEntity<?> finalizeArtifact(@PathVariable UUID id) {
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
    public ResponseEntity<byte[]> previewPdf(@PathVariable UUID id) {
        return fileResponse(id, "pdf", false);
    }

    @GetMapping("/{id}/document-artifact/download")
    public ResponseEntity<byte[]> download(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "pdf") String format) {
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
}
