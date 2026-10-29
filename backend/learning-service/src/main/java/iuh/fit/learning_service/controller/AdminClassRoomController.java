package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.service.ClassRoomService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.OffsetDateTime;
import java.time.ZoneId;

@RestController
@RequestMapping("/api/admin/classes")
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
public class AdminClassRoomController {
    private final ClassRoomService service;

    public AdminClassRoomController(ClassRoomService service) {
        this.service = service;
    }

    @GetMapping
    public Page<ClassRoomDtos.ClassRoomResponse> getAllClasses(
            @RequestParam(required = false) ClassRoomStatus status,
            @RequestParam(required = false) String tutorEmail,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") boolean reviewedByMe,
            @RequestParam(defaultValue = "false") boolean approved,
            @RequestParam(defaultValue = "false") boolean reportOnly,
            @RequestParam(required = false) String reviewer,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication
    ) {
        boolean admin = hasRole(authentication, "ROLE_ADMIN");
        String reviewerEmail = admin
                ? reviewer
                : (reviewedByMe || reportOnly ? authentication.getName() : null);
        String primarySort = reportOnly ? "reviewedAt" : "createdAt";
        return service.getAllClassesForAdmin(
                status, tutorEmail, subjectId, keyword, reviewerEmail, approved, reportOnly,
                from == null ? null : from.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime(),
                to == null ? null : to.atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime(),
                PageRequest.of(Math.max(0, page), Math.min(50, Math.max(1, size)),
                        Sort.by(Sort.Order.desc(primarySort), Sort.Order.desc("id"))));
    }

    @GetMapping("/stats")
    public ClassRoomDtos.ClassRoomStatsResponse getAdminStats() {
        return service.getAdminClassStats();
    }

    @GetMapping("/{id}")
    public ClassRoomDtos.ClassRoomResponse getClassById(@PathVariable Long id) {
        return service.getClassByIdForAdmin(id);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ClassRoomDtos.ClassRoomResponse> approveClass(
            Authentication authentication,
            @PathVariable Long id
    ) {
        ClassRoomDtos.ClassRoomResponse response = service.approveClass(id, authentication.getName());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ClassRoomDtos.ClassRoomResponse> rejectClass(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody ClassRoomDtos.RejectClassRequest request
    ) {
        ClassRoomDtos.ClassRoomResponse response = service.rejectClass(id, authentication.getName(), request.reason());
        return ResponseEntity.ok(response);
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication != null && authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role::equals);
    }
}
