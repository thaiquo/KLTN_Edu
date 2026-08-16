package iuh.fit.account_service.service;

import feign.FeignException;
import iuh.fit.account_service.client.LearningSubjectClient;
import iuh.fit.account_service.dto.learning.LearningSubjectResponse;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class LearningSubjectLookupService {
    private final LearningSubjectClient learningSubjectClient;

    public LearningSubjectLookupService(LearningSubjectClient learningSubjectClient) {
        this.learningSubjectClient = learningSubjectClient;
    }

    public LearningSubjectResponse getActiveSubject(Long subjectId) {
        try {
            return learningSubjectClient.getSubject(subjectId);
        } catch (FeignException.NotFound ex) {
            throw new ResourceNotFoundException("Subject not found");
        }
    }
}
