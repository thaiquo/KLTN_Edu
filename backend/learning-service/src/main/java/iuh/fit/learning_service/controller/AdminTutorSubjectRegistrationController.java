package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.service.TutorSubjectRegistrationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/admin/tutor-subject-registrations")
@PreAuthorize("hasAnyRole('STAFF','ADMIN')")
public class AdminTutorSubjectRegistrationController {
    private final TutorSubjectRegistrationService service;

    public AdminTutorSubjectRegistrationController(TutorSubjectRegistrationService service) { this.service = service; }

    @GetMapping
    public Page<TeachingCatalogDtos.RegistrationResponse> pending(
            Authentication authentication,
            @RequestParam(defaultValue = "false") boolean proposalsOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        boolean admin = isAdmin(authentication);
        return service.pending(admin, admin && proposalsOnly, pageable(page, size, "submittedAt"));
    }

    @GetMapping("/history")
    public Page<TeachingCatalogDtos.RegistrationResponse> history(
            Authentication authentication,
            @RequestParam(required = false) TutorSubjectRegistrationStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String reviewer,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        boolean admin = isAdmin(authentication);
        String reviewerEmail = admin ? reviewer : authentication.getName();
        return service.history(
                admin, reviewerEmail, status, search, from, to,
                pageable(page, size, "reviewedAt"));
    }

    @PostMapping("/{id}/approve")
    public TeachingCatalogDtos.RegistrationResponse approve(Authentication authentication, @PathVariable Long id,
            @Valid @RequestBody(required = false) TeachingCatalogDtos.ReviewRequest request) {
        return service.approve(id, authentication.getName(), request, isAdmin(authentication));
    }

    @PostMapping("/{id}/reject")
    public TeachingCatalogDtos.RegistrationResponse reject(Authentication authentication, @PathVariable Long id,
            @Valid @RequestBody TeachingCatalogDtos.RejectRequest request) {
        return service.reject(id, authentication.getName(), request, isAdmin(authentication));
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private PageRequest pageable(int page, int size, String field) {
        return PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size)),
                Sort.by(Sort.Order.desc(field), Sort.Order.desc("id")));
    }
}
