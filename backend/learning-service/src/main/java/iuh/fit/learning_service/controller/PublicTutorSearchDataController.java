package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.TutorSearchDataDtos;
import iuh.fit.learning_service.enums.TeachingMode;
import iuh.fit.learning_service.service.PublicTutorSearchDataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/public/tutors/search-data")
public class PublicTutorSearchDataController {
    private final PublicTutorSearchDataService service;

    public PublicTutorSearchDataController(PublicTutorSearchDataService service) {
        this.service = service;
    }

    @GetMapping
    public List<TutorSearchDataDtos.TutorSearchDataResponse> searchData(
            @RequestParam(required = false) List<Long> tutorProfileIds,
            @RequestParam(required = false) Long programTypeId,
            @RequestParam(required = false) Long educationLevelId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) Long levelId,
            @RequestParam(required = false) TeachingMode teachingMode,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) Integer minExperience,
            @RequestParam(required = false) Integer dayOfWeek,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime
    ) {
        return service.search(
                tutorProfileIds,
                programTypeId,
                educationLevelId,
                categoryId,
                subjectId,
                levelId,
                teachingMode,
                minPrice,
                maxPrice,
                minRating,
                minExperience,
                dayOfWeek,
                startTime,
                endTime
        );
    }
}
