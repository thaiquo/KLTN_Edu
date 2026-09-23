package iuh.fit.account_service.client;

import iuh.fit.account_service.dto.learning.LearningTutorRatingSummaryResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;

@FeignClient(
        name = "learning-service",
        url = "${learning.service.url}",
        contextId = "learningTutorReviewClient"
)
public interface LearningTutorReviewClient {
    @GetMapping("/api/public/tutors/{tutorId}/rating-summary")
    LearningTutorRatingSummaryResponse getRatingSummary(@PathVariable("tutorId") Long tutorId);

    @GetMapping("/api/public/tutors/rating-summaries")
    Map<Long, LearningTutorRatingSummaryResponse> getRatingSummaries(@RequestParam("tutorIds") List<Long> tutorIds);
}
