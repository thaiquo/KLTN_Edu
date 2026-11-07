package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.roster.StaffDutyDtos.*;
import iuh.fit.account_service.service.StaffDutyRosterService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/staff/duty")
@PreAuthorize("hasRole('STAFF')")
public class StaffDutyController {
    private final StaffDutyRosterService service;

    public StaffDutyController(StaffDutyRosterService service) {
        this.service = service;
    }

    @GetMapping("/my-roster")
    public WeeklyRoster myRoster(@RequestParam LocalDate weekStartDate, Authentication authentication) {
        return service.myRoster(authentication.getName(), weekStartDate);
    }

    @PostMapping("/availability")
    public WeeklyRoster submitAvailability(
            @Valid @RequestBody AvailabilityRequest request,
            Authentication authentication
    ) {
        return service.submitAvailability(authentication.getName(), request);
    }

    @PostMapping("/start-shift")
    public AssignmentView startShift(Authentication authentication) {
        return service.startShift(authentication.getName());
    }

    @GetMapping("/status")
    public DutyStatus status(Authentication authentication) {
        return service.status(authentication.getName());
    }
}
