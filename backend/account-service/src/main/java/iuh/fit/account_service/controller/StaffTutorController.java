package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.staff.TutorReviewRequest;
import iuh.fit.account_service.dto.tutor.TutorResponse;
import iuh.fit.account_service.service.StaffService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/staff/tutors")
@PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
public class StaffTutorController {

    private final StaffService staffService;

    public StaffTutorController(StaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping("/pending")
    public List<TutorResponse> getPendingTutors() {
        return staffService.getPendingTutors();
    }

    @PatchMapping("/{tutorId}/approve")
    public TutorResponse approveTutor(@PathVariable Long tutorId) {
        return staffService.approveTutor(tutorId);
    }

    @PatchMapping("/{tutorId}/reject")
    public TutorResponse rejectTutor(
            @PathVariable Long tutorId,
            @Valid @RequestBody TutorReviewRequest request
    ) {
        return staffService.rejectTutor(tutorId, request.getReason());
    }
}
