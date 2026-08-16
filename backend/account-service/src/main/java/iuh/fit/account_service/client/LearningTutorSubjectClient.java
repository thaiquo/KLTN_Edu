package iuh.fit.account_service.client;

import iuh.fit.account_service.dto.learning.LearningTutorSubjectResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "learning-service", contextId = "learningTutorSubjectClient")
public interface LearningTutorSubjectClient {
    @GetMapping("/api/tutor-subjects")
    List<LearningTutorSubjectResponse> getTutorSubjects(@RequestParam("tutorProfileIds") List<Long> tutorProfileIds);

    @GetMapping("/api/tutor-subjects/by-profile/{tutorProfileId}")
    List<LearningTutorSubjectResponse> getTutorSubjects(@PathVariable("tutorProfileId") Long tutorProfileId);
}
