package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.TutorStatisticsSourceResponse;
import iuh.fit.learning_service.service.TutorStatisticsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tutor/statistics/source")
public class TutorStatisticsController {
    private final TutorStatisticsService service;

    public TutorStatisticsController(TutorStatisticsService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasRole('TUTOR')")
    public TutorStatisticsSourceResponse statistics(
            Authentication authentication,
            @RequestParam(defaultValue = "30") int rangeDays
    ) {
        LearningUserPrincipal principal = (LearningUserPrincipal) authentication.getPrincipal();
        return service.getStatistics(principal.email(), principal.userId(), rangeDays);
    }
}
