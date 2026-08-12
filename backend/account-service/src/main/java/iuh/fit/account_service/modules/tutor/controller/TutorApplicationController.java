package iuh.fit.account_service.modules.tutor.controller;

import iuh.fit.account_service.infrastructure.security.AuthPrincipal;
import iuh.fit.account_service.infrastructure.storage.StoredObject;
import iuh.fit.account_service.infrastructure.storage.TutorCertificateStorageService;
import iuh.fit.account_service.modules.tutor.dto.CertificateUploadResponse;
import iuh.fit.account_service.modules.tutor.dto.TutorApplicationRequest;
import iuh.fit.account_service.modules.tutor.dto.TutorApplicationResponse;
import iuh.fit.account_service.modules.tutor.service.TutorApplicationService;
import iuh.fit.account_service.modules.tutor.realtime.TutorApplicationRealtimeService;
import iuh.fit.account_service.shared.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/tutor-applications")
public class TutorApplicationController {

    private final TutorApplicationService tutorApplicationService;
    private final TutorCertificateStorageService certificateStorage;
    private final TutorApplicationRealtimeService realtimeService;

    public TutorApplicationController(TutorApplicationService tutorApplicationService,
                                      TutorCertificateStorageService certificateStorage,
                                      TutorApplicationRealtimeService realtimeService) {
        this.tutorApplicationService = tutorApplicationService;
        this.certificateStorage = certificateStorage;
        this.realtimeService = realtimeService;
    }

    @GetMapping
    public ApiResponse<List<TutorApplicationResponse>> mine(@AuthenticationPrincipal AuthPrincipal principal) {
        return ApiResponse.success(tutorApplicationService.listMine(principal));
    }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@AuthenticationPrincipal AuthPrincipal principal) {
        return realtimeService.connectUser(principal.id());
    }

    @PostMapping(value = "/certificates/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CertificateUploadResponse> upload(
        @AuthenticationPrincipal AuthPrincipal principal,
        @RequestPart("file") MultipartFile file
    ) {
        StoredObject stored = certificateStorage.store(principal.id(), file);
        return ApiResponse.success(new CertificateUploadResponse(
            stored.key(), stored.url(), stored.originalFileName(), stored.contentType(), stored.size()));
    }

    @GetMapping("/certificates/{certificateId}/content")
    public ResponseEntity<byte[]> downloadOwn(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable UUID certificateId
    ) {
        return fileResponse(tutorApplicationService.downloadOwnCertificate(principal, certificateId));
    }

    @PostMapping
    public ApiResponse<TutorApplicationResponse> create(
        @AuthenticationPrincipal AuthPrincipal principal,
        @Valid @RequestBody TutorApplicationRequest request
    ) {
        return ApiResponse.success(tutorApplicationService.create(principal, request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TutorApplicationResponse> update(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable UUID id,
        @Valid @RequestBody TutorApplicationRequest request
    ) {
        return ApiResponse.success(tutorApplicationService.update(principal, id, request));
    }

    @PostMapping("/{id}/submit")
    public ApiResponse<TutorApplicationResponse> submit(
        @AuthenticationPrincipal AuthPrincipal principal,
        @PathVariable UUID id
    ) {
        return ApiResponse.success(tutorApplicationService.submit(principal, id));
    }

    private ResponseEntity<byte[]> fileResponse(TutorApplicationService.CertificateDownload download) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(download.contentType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                .filename(download.fileName(), StandardCharsets.UTF_8).build().toString())
            .body(download.content());
    }
}
