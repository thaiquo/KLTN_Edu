package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.service.TutorSubjectRegistrationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/tutor-subject-registrations")
@PreAuthorize("hasAnyRole('STAFF','ADMIN')")
public class AdminTutorSubjectRegistrationController {
    private final TutorSubjectRegistrationService service;

    public AdminTutorSubjectRegistrationController(TutorSubjectRegistrationService service) { this.service = service; }

    @GetMapping
    public List<TeachingCatalogDtos.RegistrationResponse> pending() { return service.pending(); }

    @GetMapping("/history")
    public List<TeachingCatalogDtos.RegistrationResponse> history() { return service.history(); }

    @PostMapping("/{id}/approve")
    public TeachingCatalogDtos.RegistrationResponse approve(Authentication authentication, @PathVariable Long id,
            @Valid @RequestBody(required = false) TeachingCatalogDtos.ReviewRequest request) {
        return service.approve(id, authentication.getName(), request);
    }

    @PostMapping("/{id}/reject")
    public TeachingCatalogDtos.RegistrationResponse reject(Authentication authentication, @PathVariable Long id,
            @Valid @RequestBody TeachingCatalogDtos.RejectRequest request) {
        return service.reject(id, authentication.getName(), request);
    }
}
