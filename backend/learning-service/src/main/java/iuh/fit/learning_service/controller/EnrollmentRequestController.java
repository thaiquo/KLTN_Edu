package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.*;
import iuh.fit.learning_service.service.EnrollmentRequestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping
public class EnrollmentRequestController {

    private final EnrollmentRequestService service;

    public EnrollmentRequestController(EnrollmentRequestService service) {
        this.service = service;
    }

    // -------------------------------------------------------------
    // Student Endpoints
    // -------------------------------------------------------------

    @PostMapping({"/api/v1/classes/{classId}/enroll", "/api/classes/{classId}/enroll"})
    public ResponseEntity<EnrollmentRequestResponse> enrollClass(
            Authentication authentication,
            @PathVariable Long classId,
            @RequestBody(required = false) @Valid EnrollClassRequest request
    ) {
        Long studentId = authentication.getDetails() instanceof Number value ? value.longValue() : null;
        EnrollmentRequestResponse response = service.enrollClass(classId, studentId, authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping({"/api/v1/enrollment-requests/{requestId}/cancel", "/api/enrollment-requests/{requestId}/cancel"})
    public ResponseEntity<EnrollmentRequestResponse> cancelRequest(
            Authentication authentication,
            @PathVariable Long requestId
    ) {
        EnrollmentRequestResponse response = service.cancelRequest(requestId, authentication.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/api/v1/enrollment-requests/my-requests", "/api/enrollment-requests/my-requests"})
    public List<EnrollmentRequestResponse> getMyRequests(Authentication authentication) {
        return service.getMyRequests(authentication.getName());
    }

    // -------------------------------------------------------------
    // Tutor Endpoints
    // -------------------------------------------------------------

    @PostMapping({"/api/v1/enrollment-requests/{requestId}/accept", "/api/enrollment-requests/{requestId}/accept"})
    @PreAuthorize("hasRole('TUTOR')")
    public ResponseEntity<EnrollmentRequestResponse> acceptRequest(
            Authentication authentication,
            @PathVariable Long requestId,
            @RequestBody(required = false) AcceptRequestPayload payload
    ) {
        String agreementId = payload != null ? payload.agreementId() : null;
        EnrollmentRequestResponse response = service.acceptRequest(requestId, authentication.getName(), agreementId);
        return ResponseEntity.ok(response);
    }

    // -------------------------------------------------------------
    // Internal Service Endpoints (called by contract-service)
    // -------------------------------------------------------------

    @PostMapping("/api/learning/internal/enrollment-requests/activate")
    public ResponseEntity<EnrollmentRequestResponse> internalActivateEnrollment(
            @RequestBody InternalEnrollmentActivationRequest req
    ) {
        EnrollmentRequestResponse response = service.activateEnrollment(
                req.classRoomId(), req.studentId(), req.agreementId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/learning/internal/enrollment-requests/expire")
    public ResponseEntity<EnrollmentRequestResponse> internalExpireEnrollment(
            @RequestBody InternalEnrollmentActivationRequest req
    ) {
        EnrollmentRequestResponse response = service.expireEnrollment(
                req.classRoomId(), req.studentId(), req.agreementId());
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/api/v1/enrollment-requests/{requestId}/reject", "/api/enrollment-requests/{requestId}/reject"})
    @PreAuthorize("hasRole('TUTOR')")
    public ResponseEntity<EnrollmentRequestResponse> rejectRequest(
            Authentication authentication,
            @PathVariable Long requestId,
            @RequestBody(required = false) @Valid RejectRequestPayload payload
    ) {
        String reason = payload != null ? payload.reason() : null;
        EnrollmentRequestResponse response = service.rejectRequest(requestId, authentication.getName(), reason);
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/api/v1/tutor/classes/{classId}/requests", "/api/tutor/classes/{classId}/requests"})
    @PreAuthorize("hasRole('TUTOR')")
    public List<EnrollmentRequestResponse> getRequestsForClass(
            Authentication authentication,
            @PathVariable Long classId
    ) {
        return service.getRequestsForClass(classId, authentication.getName());
    }

    @GetMapping({"/api/v1/tutor/enrollment-requests", "/api/tutor/enrollment-requests"})
    @PreAuthorize("hasRole('TUTOR')")
    public List<EnrollmentRequestResponse> getAllRequestsForTutor(Authentication authentication) {
        return service.getAllRequestsForTutor(authentication.getName());
    }

    // -------------------------------------------------------------
    // Buffer Pool Tutor Info
    // -------------------------------------------------------------

    @GetMapping({"/api/v1/classes/{classId}/buffer-pool", "/api/classes/{classId}/buffer-pool"})
    @PreAuthorize("hasRole('TUTOR')")
    public BufferPoolStatusResponse getBufferPoolStatus(Authentication authentication, @PathVariable Long classId) {
        return service.getBufferPoolStatus(classId, authentication.getName());
    }
}
