package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.subjectsuggestion.MapSubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.RejectSubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.SubjectSuggestionResponse;
import iuh.fit.account_service.service.SubjectSuggestionService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/staff/subject-suggestions")
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
public class StaffSubjectSuggestionController {

    private final SubjectSuggestionService subjectSuggestionService;

    public StaffSubjectSuggestionController(SubjectSuggestionService subjectSuggestionService) {
        this.subjectSuggestionService = subjectSuggestionService;
    }

    @GetMapping("/pending")
    public List<SubjectSuggestionResponse> pending() {
        return subjectSuggestionService.listPendingSuggestions();
    }

    @PatchMapping("/{suggestionId}/approve-new")
    public SubjectSuggestionResponse approveAsNew(
            Authentication authentication,
            @PathVariable Long suggestionId
    ) {
        return subjectSuggestionService.approveAsNew(suggestionId, authentication.getName());
    }

    @PatchMapping("/{suggestionId}/map-existing")
    public SubjectSuggestionResponse mapExisting(
            Authentication authentication,
            @PathVariable Long suggestionId,
            @Valid @RequestBody MapSubjectSuggestionRequest request
    ) {
        return subjectSuggestionService.mapToExisting(suggestionId, authentication.getName(), request);
    }

    @PatchMapping("/{suggestionId}/reject")
    public SubjectSuggestionResponse reject(
            Authentication authentication,
            @PathVariable Long suggestionId,
            @Valid @RequestBody RejectSubjectSuggestionRequest request
    ) {
        return subjectSuggestionService.reject(suggestionId, authentication.getName(), request);
    }
}
