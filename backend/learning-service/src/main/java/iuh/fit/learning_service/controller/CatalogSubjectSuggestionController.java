package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.CatalogSuggestionDtos;
import iuh.fit.learning_service.service.CatalogSubjectSuggestionService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/catalog-subject-suggestions")
public class CatalogSubjectSuggestionController {
    private final CatalogSubjectSuggestionService service;
    public CatalogSubjectSuggestionController(CatalogSubjectSuggestionService service) { this.service = service; }

    @PostMapping
    @PreAuthorize("hasRole('TUTOR')")
    public ResponseEntity<CatalogSuggestionDtos.Response> create(Authentication authentication,
            @Valid @RequestBody CatalogSuggestionDtos.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(authentication.getName(), request));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('TUTOR')")
    public List<CatalogSuggestionDtos.Response> mine(Authentication authentication) { return service.mine(authentication.getName()); }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public List<CatalogSuggestionDtos.Response> pending() { return service.pending(); }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public CatalogSuggestionDtos.Response approve(Authentication authentication, @PathVariable Long id) {
        return service.approve(id, authentication.getName());
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public CatalogSuggestionDtos.Response reject(Authentication authentication, @PathVariable Long id,
            @Valid @RequestBody CatalogSuggestionDtos.RejectRequest request) {
        return service.reject(id, authentication.getName(), request);
    }
}
