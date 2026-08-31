package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.tutor.PublicTutorResponse;
import iuh.fit.account_service.dto.tutor.TutorProfileRequest;
import iuh.fit.account_service.dto.tutor.TutorRegistrationProfileRequest;
import iuh.fit.account_service.dto.tutor.TutorResponse;
import iuh.fit.account_service.service.PublicTutorService;
import iuh.fit.account_service.service.TutorService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/tutors")
public class TutorController {

    private final TutorService tutorService;
    private final PublicTutorService publicTutorService;

    public TutorController(TutorService tutorService, PublicTutorService publicTutorService) {
        this.tutorService = tutorService;
        this.publicTutorService = publicTutorService;
    }

    @GetMapping
    public List<PublicTutorResponse> searchTutors(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) BigDecimal minRate,
            @RequestParam(required = false) BigDecimal maxRate,
            @RequestParam(required = false) Integer limit
    ) {
        return publicTutorService.searchTutors(keyword, subjectId, minRate, maxRate, limit);
    }

    @GetMapping("/{tutorProfileId}")
    public PublicTutorResponse getTutor(@PathVariable Long tutorProfileId) {
        return publicTutorService.getTutor(tutorProfileId);
    }

    @PostMapping("/profile")
    @PreAuthorize("isAuthenticated()")
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
    @PreAuthorize("isAuthenticated()")
    public TutorResponse getProfile(Authentication authentication) {
        return tutorService.getProfile(authentication.getName());
    }

    @PutMapping("/profile")
    @PreAuthorize("isAuthenticated()")
    public TutorResponse updateProfile(
            Authentication authentication,
            @Valid @RequestBody TutorProfileRequest request
    ) {
        return tutorService.updateProfile(authentication.getName(), request);
    }
}
