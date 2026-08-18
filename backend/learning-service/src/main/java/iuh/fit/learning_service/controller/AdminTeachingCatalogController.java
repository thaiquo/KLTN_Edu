package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.*;
import iuh.fit.learning_service.service.AdminCatalogService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/teaching-catalog")
@PreAuthorize("hasAnyRole('STAFF','ADMIN')")
public class AdminTeachingCatalogController {
    private final AdminCatalogService service;
    public AdminTeachingCatalogController(AdminCatalogService service) { this.service=service; }

    @PostMapping("/subjects")
    public ResponseEntity<TeachingCatalogDtos.SubjectOption> create(@Valid @RequestBody AdminCatalogDtos.CreateSubjectRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/subjects/{id}")
    public TeachingCatalogDtos.SubjectOption updateSubject(@PathVariable Long id,
            @Valid @RequestBody AdminCatalogDtos.UpdateSubjectRequest request) {
        return service.updateSubject(id, request);
    }

    @DeleteMapping("/subjects/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateSubject(@PathVariable Long id) { service.deactivateSubject(id); }

    @PostMapping("/levels")
    public ResponseEntity<TeachingCatalogDtos.LevelOption> createLevel(
            @Valid @RequestBody AdminCatalogDtos.CreateLevelRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createLevel(request));
    }

    @PutMapping("/levels/{id}")
    public TeachingCatalogDtos.LevelOption updateLevel(@PathVariable Long id,
            @Valid @RequestBody AdminCatalogDtos.UpdateLevelRequest request) {
        return service.updateLevel(id, request);
    }

    @DeleteMapping("/levels/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateLevel(@PathVariable Long id) { service.deactivateLevel(id); }

    @PostMapping(value="/imports", consumes="multipart/form-data")
    public AdminCatalogDtos.ImportResponse importCsv(Authentication authentication, @RequestParam MultipartFile file) {
        return service.importCsv(authentication.getName(), file);
    }
}
