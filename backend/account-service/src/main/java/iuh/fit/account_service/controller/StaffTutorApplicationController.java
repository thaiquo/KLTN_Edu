package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.staff.StaffRejectTutorApplicationRequest;
import iuh.fit.account_service.dto.staff.StaffReviewNoteRequest;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationDetailResponse;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationSummaryResponse;
import iuh.fit.account_service.dto.staff.StaffTutorDocumentAccessResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorDocumentDownloadResponse;
import iuh.fit.account_service.service.TutorApprovalService;
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
@RequestMapping("/api/staff/tutor-applications")
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
public class StaffTutorApplicationController {

    private final TutorApprovalService tutorApprovalService;

    public StaffTutorApplicationController(TutorApprovalService tutorApprovalService) {
        this.tutorApprovalService = tutorApprovalService;
    }

    @GetMapping("/pending")
    public List<StaffTutorApplicationSummaryResponse> pendingApplications() {
        return tutorApprovalService.listPendingApplications();
    }

    @GetMapping("/{applicationId}")
    public StaffTutorApplicationDetailResponse applicationDetail(@PathVariable Long applicationId) {
        return tutorApprovalService.getApplicationDetail(applicationId);
    }

    @GetMapping("/documents/{documentId}/access")
    public StaffTutorDocumentAccessResponse documentAccess(@PathVariable Long documentId) {
        return tutorApprovalService.createDocumentAccess(documentId);
    }

    @GetMapping("/{applicationId}/documents/{documentId}/download")
    public TutorDocumentDownloadResponse documentDownload(
            @PathVariable Long applicationId,
            @PathVariable Long documentId
    ) {
        return tutorApprovalService.createDocumentDownloadUrl(applicationId, documentId);
    }

    @PatchMapping("/{applicationId}/approve")
    public StaffTutorApplicationDetailResponse approve(
            Authentication authentication,
            @PathVariable Long applicationId,
            @Valid @RequestBody(required = false) StaffReviewNoteRequest request
    ) {
        return tutorApprovalService.approve(applicationId, authentication.getName(), request);
    }

    @PatchMapping("/{applicationId}/reject")
    public StaffTutorApplicationDetailResponse reject(
            Authentication authentication,
            @PathVariable Long applicationId,
            @Valid @RequestBody StaffRejectTutorApplicationRequest request
    ) {
        return tutorApprovalService.reject(applicationId, authentication.getName(), request);
    }
}
