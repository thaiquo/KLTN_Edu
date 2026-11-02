package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityModerationDtos.*;
import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.service.CommunityManualModerationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/community")
public class CommunityModerationController {
    private final CommunityManualModerationService service;
    public CommunityModerationController(CommunityManualModerationService service) { this.service = service; }

    @PostMapping("/posts/{postId}/reports")
    public ResponseEntity<Report> report(@PathVariable Long postId, @Valid @RequestBody ReportRequest request,
                                         Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.report(postId, request, principal(authentication)));
    }

    @GetMapping("/moderation/queue")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public Page<QueueItem> queue(@RequestParam(required = false) CommunityModerationStatus moderationStatus,
            @RequestParam(defaultValue = "false") boolean reportedOnly,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size) {
        return service.queue(moderationStatus, reportedOnly, keyword,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))));
    }

    @GetMapping("/moderation/posts/{postId}")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public Detail detail(@PathVariable Long postId,
                         @RequestParam(required = false) ModerationSource source) {
        return service.detail(postId, source);
    }

    @PostMapping("/moderation/posts/{postId}/actions")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public Detail action(@PathVariable Long postId, @Valid @RequestBody ActionRequest request,
                         Authentication authentication) {
        return service.decide(postId, request, principal(authentication));
    }

    private LearningUserPrincipal principal(Authentication auth) {
        return auth != null && auth.getPrincipal() instanceof LearningUserPrincipal p ? p : null;
    }
}
