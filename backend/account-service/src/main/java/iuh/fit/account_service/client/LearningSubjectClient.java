package iuh.fit.account_service.client;

import iuh.fit.account_service.dto.learning.LearningSubjectResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "learning-service", contextId = "learningSubjectClient")
public interface LearningSubjectClient {
    @GetMapping("/api/subjects/{subjectId}")
    LearningSubjectResponse getSubject(@PathVariable Long subjectId);
}
