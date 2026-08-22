package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.SubjectRequestDtos;
import iuh.fit.learning_service.service.SubjectRequestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/subject-requests")
public class SubjectRequestController {
    private final SubjectRequestService subjectRequestService;

    public SubjectRequestController(SubjectRequestService subjectRequestService) {
        this.subjectRequestService = subjectRequestService;
    }

    @PostMapping
    public ResponseEntity<SubjectRequestDtos.Response> create(@Valid @RequestBody SubjectRequestDtos.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(subjectRequestService.create(request));
    }

    @GetMapping("/me")
    public List<SubjectRequestDtos.Response> mine(@RequestParam Long userId) {
        return subjectRequestService.mine(userId);
    }

    @GetMapping("/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SubjectRequestDtos.Response> pending() {
        return subjectRequestService.pending();
    }

    @PatchMapping("/{requestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public SubjectRequestDtos.Response approve(
            @PathVariable Long requestId,
            @RequestParam(required = false) Long reviewedByUserId
    ) {
        return subjectRequestService.approve(requestId, reviewedByUserId);
    }

    @PatchMapping("/{requestId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public SubjectRequestDtos.Response reject(
            @PathVariable Long requestId,
            @Valid @RequestBody SubjectRequestDtos.RejectRequest request
    ) {
        return subjectRequestService.reject(requestId, request);
    }
}
