package iuh.fit.learningservice.modules.availability.controller;

import iuh.fit.learningservice.modules.availability.dto.ReplaceAvailabilityRequest;
import iuh.fit.learningservice.modules.availability.dto.TutorAvailabilityResponse;
import iuh.fit.learningservice.modules.availability.service.TutorAvailabilityService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/tutors")
public class TutorAvailabilityController {

    public static final String USER_ID_HEADER = "X-User-Id";

    private final TutorAvailabilityService availabilityService;

    public TutorAvailabilityController(TutorAvailabilityService availabilityService) {
        this.availabilityService = availabilityService;
    }

    @GetMapping("/{tutorId}/availability")
    public List<TutorAvailabilityResponse> getTutorAvailability(@PathVariable UUID tutorId) {
        return availabilityService.getByTutorId(tutorId);
    }

    @GetMapping("/me/availability")
    public List<TutorAvailabilityResponse> getMyAvailability(
        @RequestHeader(USER_ID_HEADER) UUID tutorId
    ) {
        return availabilityService.getByTutorId(tutorId);
    }

    @PutMapping("/me/availability")
    public List<TutorAvailabilityResponse> replaceMyAvailability(
        @RequestHeader(USER_ID_HEADER) UUID tutorId,
        @Valid @RequestBody ReplaceAvailabilityRequest request
    ) {
        return availabilityService.replace(tutorId, request);
    }
}
