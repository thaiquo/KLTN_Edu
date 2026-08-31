package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.tutorapplication.TutorDocumentDownloadResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorDocumentResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorApplicationResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorApplicationSubjectRequest;
import iuh.fit.account_service.dto.tutorapplication.TutorApplicationSubjectResponse;
import iuh.fit.account_service.dto.tutorapplication.UpdateTutorApplicationRequest;
import iuh.fit.account_service.dto.tutorapplication.UpdateTutorApplicationSubjectRequest;
import iuh.fit.account_service.enums.CredentialValidityType;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.service.TutorDocumentService;
import iuh.fit.account_service.service.TutorApplicationService;
import iuh.fit.account_service.service.TutorApplicationSubjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/tutor-applications")
@PreAuthorize("isAuthenticated()")
public class TutorApplicationController {

    private final TutorApplicationService tutorApplicationService;
    private final TutorApplicationSubjectService tutorApplicationSubjectService;
    private final TutorDocumentService tutorDocumentService;

    public TutorApplicationController(
            TutorApplicationService tutorApplicationService,
            TutorApplicationSubjectService tutorApplicationSubjectService,
            TutorDocumentService tutorDocumentService
    ) {
        this.tutorApplicationService = tutorApplicationService;
        this.tutorApplicationSubjectService = tutorApplicationSubjectService;
        this.tutorDocumentService = tutorDocumentService;
    }

    @GetMapping("/me")
    public TutorApplicationResponse getMyApplication(Authentication authentication) {
        return tutorApplicationService.getMyApplication(authentication.getName());
    }

    @PostMapping
    public ResponseEntity<TutorApplicationResponse> createMyApplication(Authentication authentication) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(tutorApplicationService.createMyApplication(authentication.getName()));
    }

    @PostMapping("/me/submit")
    public TutorApplicationResponse submitMyApplication(Authentication authentication) {
        return tutorApplicationService.submitMyApplication(authentication.getName());
    }

    @PostMapping("/me/submit-profile")
    public TutorApplicationResponse submitProfileForReview(Authentication authentication) {
        return tutorApplicationService.submitMyApplication(authentication.getName());
    }

    @PutMapping("/me")
    public TutorApplicationResponse updateMyApplication(
            Authentication authentication,
            @Valid @RequestBody UpdateTutorApplicationRequest request
    ) {
        return tutorApplicationService.updateMyApplication(authentication.getName(), request);
    }

    @GetMapping("/me/subjects")
    public List<TutorApplicationSubjectResponse> listMySubjects(Authentication authentication) {
        return tutorApplicationSubjectService.listMySubjects(authentication.getName());
    }

    @PostMapping("/me/subjects")
    public ResponseEntity<TutorApplicationSubjectResponse> addSubject(
            Authentication authentication,
            @Valid @RequestBody TutorApplicationSubjectRequest request
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(tutorApplicationSubjectService.addSubject(authentication.getName(), request));
    }

    @PutMapping("/me/subjects/{id}")
    public TutorApplicationSubjectResponse updateSubject(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody UpdateTutorApplicationSubjectRequest request
    ) {
        return tutorApplicationSubjectService.updateSubject(authentication.getName(), id, request);
    }

    @DeleteMapping("/me/subjects/{id}")
    public ResponseEntity<Void> deleteSubject(
            Authentication authentication,
            @PathVariable Long id
    ) {
        tutorApplicationSubjectService.deleteSubject(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me/documents")
    public List<TutorDocumentResponse> listMyDocuments(Authentication authentication) {
        return tutorDocumentService.listMyDocuments(authentication.getName());
    }

    @PostMapping(value = "/me/documents", consumes = "multipart/form-data")
    public ResponseEntity<TutorDocumentResponse> uploadDocument(
            Authentication authentication,
            @RequestParam TutorDocumentType documentType,
            @RequestParam MultipartFile file,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String issuer,
            @RequestParam(required = false) LocalDate issueDate,
            @RequestParam(required = false) CredentialValidityType validityType,
            @RequestParam(required = false) LocalDate expiryDate,
            @RequestParam(required = false) String credentialNumber
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(tutorDocumentService.uploadMyDocument(
                        authentication.getName(),
                        documentType,
                        file,
                        title,
                        issuer,
                        issueDate,
                        validityType,
                        expiryDate,
                        credentialNumber
                ));
    }

    @GetMapping("/me/documents/{id}/download")
    public TutorDocumentDownloadResponse downloadDocument(
            Authentication authentication,
            @PathVariable Long id
    ) {
        return tutorDocumentService.createDownloadUrl(authentication.getName(), id);
    }

    @DeleteMapping("/me/documents/{id}")
    public ResponseEntity<Void> deleteDocument(
            Authentication authentication,
            @PathVariable Long id
    ) {
        tutorDocumentService.deleteMyDocument(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
