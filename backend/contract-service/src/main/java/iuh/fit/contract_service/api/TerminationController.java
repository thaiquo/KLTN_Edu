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
import org.springframework.format.annotation.DateTimeFormat;

import java.util.*;
import java.time.OffsetDateTime;

@RestController @RequestMapping("/api/contracts/terminations") @RequiredArgsConstructor
public class TerminationController {
    private final TerminationService service;
    private final CurrentUserContext users;
    private final DisputeEvidenceStorageService evidenceStorage;
    private final TerminationEvidenceRepository evidenceRepository;

    public record Request(UUID agreementId, boolean wholeClass, String reason, String signature, String signerWallet, Long requestedAtTimestamp) {}
    public record AdminRequest(UUID agreementId, boolean wholeClass, String reason, boolean approveImmediately) {}
    public record Action(String action, String reason) {}

    @GetMapping public List<TerminationService.View> list() { return service.list(users.requireCurrentUser()); }

    @GetMapping("/page")
    public org.springframework.data.domain.Page<TerminationService.View> page(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String statusGroup,
            @RequestParam(required = false) String origin,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String actor,
            @RequestParam(defaultValue = "false") boolean reportOnly,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) Long classroomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        var pageable = org.springframework.data.domain.PageRequest.of(
                Math.max(0, page),
                Math.min(50, Math.max(1, size)),
                org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Order.desc(reportOnly ? "updatedAt" : "createdAt"),
                        org.springframework.data.domain.Sort.Order.desc("id")));
        return service.page(
                users.requireCurrentUser(), status, statusGroup, origin, keyword, actor,
                reportOnly, from, to, classroomId, pageable);
    }

    @GetMapping("/refunds") public List<TerminationService.View> listRefunds() {
        return service.listRefunds(users.requireCurrentUser());
    }

    @PostMapping public TerminationService.View request(@RequestBody Request body) {
        return service.request(body.agreementId(), body.wholeClass(), body.reason(), body.signature(), body.signerWallet(), body.requestedAtTimestamp(), users.requireCurrentUser());
    }

    @PostMapping("/admin") public TerminationService.View adminRequest(@RequestBody AdminRequest body) {
        return service.adminRequest(body.agreementId(), body.wholeClass(), body.reason(),
                body.approveImmediately(), users.requireCurrentUser());
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
