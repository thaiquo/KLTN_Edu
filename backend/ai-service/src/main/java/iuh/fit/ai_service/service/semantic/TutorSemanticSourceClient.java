package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;

import java.util.List;

public interface TutorSemanticSourceClient {
    List<TutorCandidate> findEligibleTutorsForSemanticIndexing();
}
