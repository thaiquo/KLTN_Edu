package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.staff.StaffRejectTutorApplicationRequest;
import iuh.fit.account_service.dto.staff.StaffReviewNoteRequest;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationDetailResponse;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationSummaryResponse;
import iuh.fit.account_service.dto.staff.StaffTutorDocumentAccessResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorDocumentDownloadResponse;
import iuh.fit.account_service.service.TutorApprovalService;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/staff/tutor-applications")
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
public class StaffTutorApplicationController {

    private final TutorApprovalService tutorApprovalService;

    public StaffTutorApplicationController(TutorApprovalService tutorApprovalService) {
        this.tutorApprovalService = tutorApprovalService;
    }

    @GetMapping("/pending")
    public Page<StaffTutorApplicationSummaryResponse> pendingApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return tutorApprovalService.listPendingApplications(pageable(page, size, "submittedAt"));
    }

    @GetMapping("/history")
    public Page<StaffTutorApplicationSummaryResponse> historyApplications(
            Authentication authentication,
            @RequestParam(required = false) TutorApplicationStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String reviewer,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return tutorApprovalService.listHistory(
                authentication.getName(), status, search, reviewer, from, to,
                pageable(page, size, "reviewedAt"));
    }

    private PageRequest pageable(int page, int size, String field) {
        return PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size)),
                Sort.by(Sort.Order.desc(field), Sort.Order.desc("id")));
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
