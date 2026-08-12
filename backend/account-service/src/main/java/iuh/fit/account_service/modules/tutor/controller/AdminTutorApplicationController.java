package iuh.fit.account_service.modules.tutor.controller;

import iuh.fit.account_service.infrastructure.security.AuthPrincipal;
import iuh.fit.account_service.modules.tutor.dto.TutorApplicationResponse;
import iuh.fit.account_service.modules.tutor.dto.TutorRejectionRequest;
import iuh.fit.account_service.modules.tutor.dto.TutorApprovalRequest;
import iuh.fit.account_service.modules.tutor.service.TutorApplicationService;
import iuh.fit.account_service.shared.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.nio.charset.StandardCharsets;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import iuh.fit.account_service.modules.tutor.realtime.TutorApplicationRealtimeService;

@RestController
@RequestMapping("/admin/tutor-applications")
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
public class AdminTutorApplicationController {

    private final TutorApplicationService tutorApplicationService;
    private final TutorApplicationRealtimeService realtimeService;

    public AdminTutorApplicationController(TutorApplicationService tutorApplicationService,
                                           TutorApplicationRealtimeService realtimeService) {
        this.tutorApplicationService = tutorApplicationService;
        this.realtimeService = realtimeService;
    }

    @GetMapping
    public ApiResponse<Page<TutorApplicationResponse>> list(Pageable pageable) {
        return ApiResponse.success(tutorApplicationService.list(pageable));
    }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() { return realtimeService.connectAdmin(); }

    @PostMapping("/{id}/approve")
    public ApiResponse<TutorApplicationResponse> approve(
        @AuthenticationPrincipal AuthPrincipal reviewer,
        @PathVariable UUID id,
        @Valid @RequestBody TutorApprovalRequest request
    ) {
        return ApiResponse.success(tutorApplicationService.approve(reviewer, id, request.note()));
    }

    @GetMapping("/{applicationId}/certificates/{certificateId}/content")
    public ResponseEntity<byte[]> downloadCertificate(
        @PathVariable UUID applicationId,
        @PathVariable UUID certificateId
    ) {
        var download = tutorApplicationService.downloadForReview(applicationId, certificateId);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(download.contentType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                .filename(download.fileName(), StandardCharsets.UTF_8).build().toString())
            .body(download.content());
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<TutorApplicationResponse> reject(
        @AuthenticationPrincipal AuthPrincipal reviewer,
        @PathVariable UUID id,
        @Valid @RequestBody TutorRejectionRequest request
    ) {
        return ApiResponse.success(tutorApplicationService.reject(reviewer, id, request.reason()));
    }
}
