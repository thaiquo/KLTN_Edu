package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.repository.TerminationEvidenceRepository;
import iuh.fit.contract_service.service.DisputeEvidenceStorageService;
import iuh.fit.contract_service.service.TerminationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController @RequestMapping("/api/contracts/terminations") @RequiredArgsConstructor
public class TerminationController {
    private final TerminationService service;
    private final CurrentUserContext users;
    private final DisputeEvidenceStorageService evidenceStorage;
    private final TerminationEvidenceRepository evidenceRepository;

    public record Request(UUID agreementId, boolean wholeClass, String reason, String signature, String signerWallet, Long requestedAtTimestamp) {}
    public record Action(String action, String reason) {}

    @GetMapping public List<TerminationService.View> list() { return service.list(users.requireCurrentUser()); }

    @PostMapping public TerminationService.View request(@RequestBody Request body) {
        return service.request(body.agreementId(), body.wholeClass(), body.reason(), body.signature(), body.signerWallet(), body.requestedAtTimestamp(), users.requireCurrentUser());
    }

    @PostMapping("/{id}/actions") public TerminationService.View act(@PathVariable UUID id, @RequestBody Action body) {
        return service.act(id, body.action(), body.reason(), users.requireCurrentUser());
    }

    @PostMapping(value = "/{id}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<TerminationService.View> uploadEvidence(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file) {
        var user = users.requireCurrentUser();
        service.requireCanAddEvidence(id, user);
        DisputeEvidenceStorageService.StoredEvidence stored = null;
        try {
            stored = evidenceStorage.storeTermination(id, user.activeRole(), file);
            var view = service.addEvidence(id, user, stored);
            return ResponseEntity.ok(view);
        } catch (ResponseStatusException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            throw ex;
        } catch (IllegalArgumentException ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        } catch (Exception ex) {
            if (stored != null) evidenceStorage.deleteQuietly(stored.objectKey());
            throw ex;
        }
    }

    @GetMapping("/{id}/evidence/{evidenceId}/content")
    public ResponseEntity<byte[]> readEvidence(
            @PathVariable UUID id,
            @PathVariable UUID evidenceId) {
        var user = users.requireCurrentUser();
        service.requireCanView(id, user);
        var item = evidenceRepository.findById(evidenceId)
                .filter(e -> e.getTerminationCase().getId().equals(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evidence not found"));
        byte[] bytes = evidenceStorage.readTermination(item.getObjectKey());
        MediaType contentType;
        try {
            contentType = MediaType.parseMediaType(item.getContentType());
        } catch (Exception ignored) {
            contentType = MediaType.APPLICATION_OCTET_STREAM;
        }
        String filename = evidenceStorage.filename(item.getObjectKey()).replace("\"", "_");
        return ResponseEntity.ok()
                .contentType(contentType)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header("X-Content-Type-Options", "nosniff")
                .body(bytes);
    }

}
