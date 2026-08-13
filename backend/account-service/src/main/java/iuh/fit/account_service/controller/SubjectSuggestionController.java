package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.subjectsuggestion.SubjectSuggestionRequest;
import iuh.fit.account_service.dto.subjectsuggestion.SubjectSuggestionResponse;
import iuh.fit.account_service.service.SubjectSuggestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/subject-suggestions")
@PreAuthorize("isAuthenticated()")
public class SubjectSuggestionController {

    private final SubjectSuggestionService subjectSuggestionService;

    public SubjectSuggestionController(SubjectSuggestionService subjectSuggestionService) {
        this.subjectSuggestionService = subjectSuggestionService;
    }

    @PostMapping
    public ResponseEntity<SubjectSuggestionResponse> create(
            Authentication authentication,
            @Valid @RequestBody SubjectSuggestionRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(subjectSuggestionService.createMySuggestion(authentication.getName(), request));
    }

    @GetMapping("/me")
    public List<SubjectSuggestionResponse> mine(Authentication authentication) {
        return subjectSuggestionService.listMySuggestions(authentication.getName());
    }
}
