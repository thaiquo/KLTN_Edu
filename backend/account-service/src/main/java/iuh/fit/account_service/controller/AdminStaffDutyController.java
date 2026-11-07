package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.roster.StaffDutyDtos.*;
import iuh.fit.account_service.service.StaffDutyRosterService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/staff-duty")
@PreAuthorize("hasRole('ADMIN')")
public class AdminStaffDutyController {
    private final StaffDutyRosterService service;

    public AdminStaffDutyController(StaffDutyRosterService service) {
        this.service = service;
    }

    @GetMapping("/roster")
    public WeeklyRoster roster(@RequestParam LocalDate weekStartDate) {
        return service.adminRoster(weekStartDate);
    }

    @PostMapping("/auto-assign")
    public WeeklyRoster autoAssign(@RequestParam LocalDate weekStartDate, Authentication authentication) {
        return service.autoAssign(weekStartDate, authentication.getName());
    }

    @PostMapping("/draft")
    public WeeklyRoster createDraft(@RequestParam LocalDate weekStartDate, Authentication authentication) {
        return service.createDraft(weekStartDate, authentication.getName());
    }

    @PutMapping("/assignments/{id}")
    public AssignmentView manualAssign(
            @PathVariable Long id,
            @Valid @RequestBody ManualAssignRequest request,
            Authentication authentication
    ) {
        return service.manualAssign(id, request.staffId(), authentication.getName());
    }

    @PostMapping("/publish")
    public WeeklyRoster publish(@RequestParam LocalDate weekStartDate, Authentication authentication) {
        return service.publish(weekStartDate, authentication.getName());
    }

    @PostMapping("/assignments/{id}/replace")
    public AssignmentView replace(
            @PathVariable Long id,
            @Valid @RequestBody EmergencyReplaceRequest request,
            Authentication authentication
    ) {
        return service.replace(id, request, authentication.getName());
    }

    @GetMapping("/audits")
    public Page<AuditView> audits(Pageable pageable) {
        return service.audits(pageable);
    }
}
