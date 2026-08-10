package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.tutor.TutorProfileRequest;
import iuh.fit.account_service.dto.tutor.TutorRegistrationProfileRequest;
import iuh.fit.account_service.dto.tutor.TutorResponse;
import iuh.fit.account_service.service.TutorService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tutors")
public class TutorController {

    private final TutorService tutorService;

    public TutorController(TutorService tutorService) {
        this.tutorService = tutorService;
    }

    @PostMapping("/profile")
    @PreAuthorize("hasRole('TUTOR')")
    public TutorResponse createProfile(
            Authentication authentication,
            @Valid @RequestBody TutorProfileRequest request
    ) {
        return tutorService.createProfile(authentication.getName(), request);
    }

    @PostMapping("/profile/registration")
    public TutorResponse createRegistrationProfile(
            @Valid @RequestBody TutorRegistrationProfileRequest request
    ) {
        return tutorService.createRegistrationProfile(request);
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('TUTOR')")
    public TutorResponse getProfile(Authentication authentication) {
        return tutorService.getProfile(authentication.getName());
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('TUTOR')")
    public TutorResponse updateProfile(
            Authentication authentication,
            @Valid @RequestBody TutorProfileRequest request
    ) {
        return tutorService.updateProfile(authentication.getName(), request);
    }
}
