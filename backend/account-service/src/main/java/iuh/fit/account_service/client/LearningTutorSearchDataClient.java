package iuh.fit.account_service.client;

import iuh.fit.account_service.dto.learning.LearningTutorSearchDataResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.util.List;

@FeignClient(
        name = "learning-service",
        url = "${learning.service.url}",
        contextId = "learningTutorSearchDataClient"
)
public interface LearningTutorSearchDataClient {
    @GetMapping("/api/public/tutors/search-data")
    List<LearningTutorSearchDataResponse> searchData(
            @RequestParam(value = "tutorProfileIds", required = false) List<Long> tutorProfileIds,
            @RequestParam(value = "programTypeId", required = false) Long programTypeId,
            @RequestParam(value = "educationLevelId", required = false) Long educationLevelId,
            @RequestParam(value = "categoryId", required = false) Long categoryId,
            @RequestParam(value = "subjectId", required = false) Long subjectId,
            @RequestParam(value = "levelId", required = false) Long levelId,
            @RequestParam(value = "teachingMode", required = false) String teachingMode,
            @RequestParam(value = "minPrice", required = false) BigDecimal minPrice,
            @RequestParam(value = "maxPrice", required = false) BigDecimal maxPrice,
            @RequestParam(value = "minRating", required = false) Double minRating,
            @RequestParam(value = "minExperience", required = false) Integer minExperience,
            @RequestParam(value = "dayOfWeek", required = false) Integer dayOfWeek,
            @RequestParam(value = "startTime", required = false) String startTime,
            @RequestParam(value = "endTime", required = false) String endTime
    );
}
