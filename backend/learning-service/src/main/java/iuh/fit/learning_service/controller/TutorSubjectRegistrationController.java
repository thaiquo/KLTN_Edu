package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.service.TutorSubjectRegistrationService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/tutor/subject-registrations")
@PreAuthorize("hasRole('TUTOR')")
public class TutorSubjectRegistrationController {
    private final TutorSubjectRegistrationService service;

    public TutorSubjectRegistrationController(TutorSubjectRegistrationService service) { this.service = service; }

    @GetMapping
    public List<TeachingCatalogDtos.RegistrationResponse> mine(Authentication authentication) {
        return service.mine(authentication.getName());
    }

    @PostMapping
    public ResponseEntity<TeachingCatalogDtos.RegistrationResponse> create(
            Authentication authentication, @Valid @RequestBody TeachingCatalogDtos.CreateRegistrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(authentication.getName(), request));
    }

    @PostMapping("/batch")
    public ResponseEntity<TeachingCatalogDtos.RegistrationResponse> createBatch(
            Authentication authentication,
            @Valid @RequestBody TeachingCatalogDtos.CreateRegistrationBatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createBatch(authentication.getName(), request));
    }
}
