package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.*;
import iuh.fit.learning_service.service.AdminCatalogService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

@RestController
@RequestMapping("/api/admin/teaching-catalog")
@PreAuthorize("hasRole('ADMIN')")
public class AdminTeachingCatalogController {
    private final AdminCatalogService service;
    public AdminTeachingCatalogController(AdminCatalogService service) { this.service=service; }

    @GetMapping
    public AdminCatalogDtos.CatalogSnapshot snapshot() { return service.snapshot(); }

    @GetMapping("/references")
    public AdminCatalogDtos.CatalogReferences references() { return service.references(); }

    @GetMapping("/categories")
    public Page<AdminCatalogDtos.ManagedCategory> categories(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String programCode,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            Pageable pageable) {
        int page = Math.max(0, pageable.getPageNumber());
        int size = Math.min(50, Math.max(1, pageable.isPaged() ? pageable.getPageSize() : 10));
        Pageable normalized = PageRequest.of(page, size, Sort.by(
                Sort.Order.asc("orderIndex"), Sort.Order.asc("name"), Sort.Order.asc("id")));
        return service.categories(keyword, programCode, includeInactive, normalized);
    }

    @PostMapping("/categories")
    public ResponseEntity<AdminCatalogDtos.ManagedCategory> createCategory(
            @Valid @RequestBody AdminCatalogDtos.CreateCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createCategory(request));
    }

    @PutMapping("/categories/{id}")
    public AdminCatalogDtos.ManagedCategory updateCategory(@PathVariable Long id,
            @Valid @RequestBody AdminCatalogDtos.UpdateCategoryRequest request) {
        return service.updateCategory(id, request);
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateCategory(@PathVariable Long id) { service.deactivateCategory(id); }

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
