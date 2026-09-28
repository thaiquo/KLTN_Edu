package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingResponse;
import iuh.fit.ai_service.service.TutorMatchingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/matching")
public class TutorMatchingController {
    private final TutorMatchingService tutorMatchingService;

    public TutorMatchingController(TutorMatchingService tutorMatchingService) {
        this.tutorMatchingService = tutorMatchingService;
    }

    @PostMapping("/tutors")
    public TutorMatchingResponse matchTutors(@Valid @RequestBody TutorMatchingRequest request) {
        return tutorMatchingService.match(request);
    }
}
